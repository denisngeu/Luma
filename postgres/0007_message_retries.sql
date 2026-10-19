ALTER TABLE messages ADD COLUMN client_id text;
CREATE UNIQUE INDEX messages_client_retry ON messages(author,client_id) WHERE client_id IS NOT NULL;
