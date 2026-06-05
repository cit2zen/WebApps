-- db/schema.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- threads는 nodes를 참조하지만, nodes도 threads를 참조함 (순환).
-- 해결: threads 먼저 만들되 FK는 나중에 ALTER로 추가.
CREATE TABLE IF NOT EXISTS threads (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_node_id uuid,  -- FK는 nodes 생성 후 추가
  label          text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nodes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  parent_id  uuid REFERENCES nodes(id) ON DELETE CASCADE,
  thread_id  uuid REFERENCES threads(id) ON DELETE CASCADE,  -- null = 메인 체인
  question   text NOT NULL,
  response   jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- threads.parent_node_id FK (nodes 생성 후)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_threads_parent_node'
  ) THEN
    ALTER TABLE threads
      ADD CONSTRAINT fk_threads_parent_node
      FOREIGN KEY (parent_node_id) REFERENCES nodes(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS srs_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id     uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  front       text NOT NULL,
  back        text NOT NULL,
  category    text NOT NULL DEFAULT '',
  topic       text NOT NULL DEFAULT '',
  due_date    date NOT NULL DEFAULT CURRENT_DATE,
  interval    int NOT NULL DEFAULT 1,
  ease_factor float NOT NULL DEFAULT 2.5
);

CREATE TABLE IF NOT EXISTS srs_reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     uuid NOT NULL REFERENCES srs_cards(id) ON DELETE CASCADE,
  rating      int NOT NULL CHECK (rating BETWEEN 1 AND 4),
  reviewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nodes_session ON nodes(session_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_thread ON nodes(thread_id);
CREATE INDEX IF NOT EXISTS idx_threads_parent_node ON threads(parent_node_id);
CREATE INDEX IF NOT EXISTS idx_srs_cards_due ON srs_cards(due_date);
