ALTER TABLE messages ADD COLUMN delivery_seq bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX messages_delivery_sequence ON messages(delivery_seq);
CREATE INDEX messages_visible_by_chat ON messages(chat, scheduled, delivery_seq) WHERE hidden = 0;
CREATE INDEX messages_visible_delivery ON messages(chat, delivery_seq DESC) WHERE hidden = 0;
CREATE INDEX messages_activity_by_chat ON messages(chat, (CASE WHEN scheduled > created THEN scheduled ELSE created END) DESC, delivery_seq DESC) WHERE hidden = 0;

CREATE TABLE chat_reads (
  chat text NOT NULL,
  "user" text NOT NULL,
  read_through bigint NOT NULL CHECK (read_through >= 0),
  read_sequence bigint NOT NULL CHECK (read_sequence >= 0),
  PRIMARY KEY (chat, "user"),
  FOREIGN KEY (chat, "user") REFERENCES members(chat, "user") ON DELETE CASCADE
);
