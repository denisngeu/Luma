import {Pool,types} from 'pg';

// The application uses millisecond timestamps and bounded counters.
types.setTypeParser(20,value=>{const n=Number(value);if(!Number.isSafeInteger(n))throw Error('PostgreSQL integer exceeds the supported range');return n;});
export type QueryResult={rows:Record<string,unknown>[];rowCount?:number|null;affectedRows?:number};
export type Connection={query:(sql:string,values?:unknown[])=>Promise<QueryResult>;release?:()=>void};
export type DatabaseDriver=Connection&{connect:()=>Promise<Connection>};

// Keep placeholders separate from values, including question marks in SQL strings.
// This compatibility layer is limited to the SQL used by the existing Luma API.
export function postgresSql(source:string){
 let index=0;
 let sql=source.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|`[^`]*`|\?|\b[A-Za-z_][A-Za-z_0-9]*\b/g,token=>{
  if(token==='?')return '$'+(++index);
  if(token.startsWith('`'))return '"'+token.slice(1,-1)+'"';
  if(token.toLowerCase()==='user'||/^[a-z][a-zA-Z]*[A-Z][a-zA-Z]*$/.test(token))return '"'+token+'"';
  return token;
 });
 if(/^\s*INSERT OR IGNORE INTO /i.test(sql))sql=sql.replace(/INSERT OR IGNORE INTO /i,'INSERT INTO ').replace(/;?\s*$/,' ON CONFLICT DO NOTHING');
 sql=sql.replace(/lower\(hex\(randomblob\(16\)\)\)/gi,"replace(gen_random_uuid()::text,'-','')");
 return sql;
}
export class PostgresStatement{
 constructor(readonly driver:Connection,readonly sql:string,readonly values:unknown[]=[]){ }
 bind(...values:unknown[]){return new PostgresStatement(this.driver,this.sql,values);}
 async execute(connection=this.driver){const result=await connection.query(postgresSql(this.sql),this.values);return {...result,rows:result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='boolean'?Number(value):value])))};}
 async first<T=Record<string,unknown>>():Promise<T|null>{return ((await this.execute()).rows[0] as T)||null;}
 async all<T=Record<string,unknown>>(){return {results:(await this.execute()).rows as T[]};}
 async run(){const r=await this.execute();return {meta:{changes:r.rowCount??r.affectedRows??0}};}
}
export class PostgresDatabase{
 constructor(readonly driver:DatabaseDriver){}
 prepare(sql:string){return new PostgresStatement(this.driver,sql);}
 async batch(statements:PostgresStatement[]){
  const client=await this.driver.connect();
  try{await client.query('BEGIN');const results=[];for(const statement of statements){const r=await statement.execute(client);results.push({results:r.rows,meta:{changes:r.rowCount??r.affectedRows??0}});}await client.query('COMMIT');return results;}
  catch(error){await client.query('ROLLBACK');throw error;}finally{client.release?.();}
 }
}
let pool:Pool|undefined;
let database:PostgresDatabase|undefined;
export function getDatabase(){
 if(database)return database;
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
 pool=new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,statement_timeout:15000});
 pool.on('error',()=>console.error('PostgreSQL connection interrupted'));
 database=new PostgresDatabase(pool as unknown as DatabaseDriver);return database;
}
