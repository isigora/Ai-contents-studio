CREATE TABLE IF NOT EXISTS auth_user(id text PRIMARY KEY,name text NOT NULL,email text NOT NULL UNIQUE,email_verified boolean NOT NULL DEFAULT false,image text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS auth_session(id text PRIMARY KEY,user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,token text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,ip_address text,user_agent text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS session_user_idx ON auth_session(user_id);
CREATE TABLE IF NOT EXISTS auth_account(id text PRIMARY KEY,user_id text NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,account_id text NOT NULL,provider_id text NOT NULL,access_token text,refresh_token text,id_token text,access_token_expires_at timestamptz,refresh_token_expires_at timestamptz,scope text,password text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(provider_id,account_id));
CREATE TABLE IF NOT EXISTS auth_verification(id text PRIMARY KEY,identifier text NOT NULL,value text NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS workspace(id text PRIMARY KEY,name text NOT NULL,locale text NOT NULL DEFAULT 'ko',revision integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS membership(workspace_id text NOT NULL REFERENCES workspace(id),user_id text NOT NULL REFERENCES auth_user(id),role text NOT NULL CHECK(role IN('owner','editor','viewer')),PRIMARY KEY(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS company(workspace_id text PRIMARY KEY REFERENCES workspace(id),data jsonb NOT NULL DEFAULT '{}',revision integer NOT NULL DEFAULT 1,updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audience(id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspace(id),data jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,archived boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id));
CREATE TABLE IF NOT EXISTS offering(id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspace(id),audience_id text NOT NULL,data jsonb NOT NULL,revision integer NOT NULL DEFAULT 1,archived boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),FOREIGN KEY(workspace_id,audience_id) REFERENCES audience(workspace_id,id));
CREATE TABLE IF NOT EXISTS knowledge_revision(id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspace(id),entity_type text NOT NULL,entity_id text NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,created_by text NOT NULL REFERENCES auth_user(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,entity_type,entity_id,revision));
CREATE TABLE IF NOT EXISTS asset(id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspace(id),object_key text NOT NULL UNIQUE,name text NOT NULL,mime text NOT NULL,size integer NOT NULL CHECK(size>0),rights_note text NOT NULL DEFAULT '',status text NOT NULL CHECK(status IN('ready','quarantined')),created_by text NOT NULL REFERENCES auth_user(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id));
CREATE TABLE IF NOT EXISTS content(id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspace(id),offering_id text NOT NULL,audience_id text NOT NULL,settings jsonb NOT NULL,source_snapshot jsonb NOT NULL,source_revision integer NOT NULL,status text NOT NULL DEFAULT 'draft' CHECK(status IN('draft','reviewed')),current_version integer NOT NULL DEFAULT 1,created_by text NOT NULL REFERENCES auth_user(id),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(workspace_id,id),FOREIGN KEY(workspace_id,offering_id) REFERENCES offering(workspace_id,id),FOREIGN KEY(workspace_id,audience_id) REFERENCES audience(workspace_id,id));
CREATE TABLE IF NOT EXISTS content_version(id text PRIMARY KEY,workspace_id text NOT NULL,content_id text NOT NULL,version integer NOT NULL,title text NOT NULL,body text NOT NULL,annotations jsonb NOT NULL,created_by text NOT NULL REFERENCES auth_user(id),created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(workspace_id,content_id) REFERENCES content(workspace_id,id),UNIQUE(content_id,version));
CREATE TABLE IF NOT EXISTS generation_run(id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspace(id),user_id text NOT NULL REFERENCES auth_user(id),idempotency_key text NOT NULL,request_hash text NOT NULL,status text NOT NULL CHECK(status IN('running','succeeded','failed')),content_id text,model text NOT NULL,prompt_version text NOT NULL DEFAULT 'facts-v1',request jsonb NOT NULL,cost_estimate numeric NOT NULL DEFAULT 0,error_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(workspace_id,content_id) REFERENCES content(workspace_id,id),UNIQUE(workspace_id,idempotency_key));
CREATE TABLE IF NOT EXISTS audit_event(id text PRIMARY KEY,workspace_id text REFERENCES workspace(id),user_id text NOT NULL,action text NOT NULL,entity_id text,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS offering_workspace_idx ON offering(workspace_id);
CREATE INDEX IF NOT EXISTS content_workspace_idx ON content(workspace_id,updated_at);
CREATE INDEX IF NOT EXISTS generation_rate_idx ON generation_run(workspace_id,created_at);

-- Additive P0 intake: one transaction, repeatable retries, no existing row replacement.
CREATE TABLE IF NOT EXISTS knowledge_intake(
 workspace_id text NOT NULL REFERENCES workspace(id),user_id text NOT NULL REFERENCES auth_user(id),
 request_key text NOT NULL,request_hash text NOT NULL,offering_id text NOT NULL,audience_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(workspace_id,user_id,request_key),
 FOREIGN KEY(workspace_id,offering_id) REFERENCES offering(workspace_id,id),
 FOREIGN KEY(workspace_id,audience_id) REFERENCES audience(workspace_id,id));
CREATE INDEX IF NOT EXISTS intake_rate_idx ON knowledge_intake(workspace_id,created_at);

-- Unconfirmed AI intake is private, durable and separate from approved business facts.
CREATE TABLE IF NOT EXISTS ai_interpretation(
 id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES workspace(id),user_id text NOT NULL REFERENCES auth_user(id),
 request_key text NOT NULL,request_hash text NOT NULL,source text NOT NULL,model text NOT NULL,
 status text NOT NULL CHECK(status IN('running','succeeded','failed')),result jsonb,error_code text,
 cost_estimate numeric NOT NULL CHECK(cost_estimate>0),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,user_id,request_key));
CREATE INDEX IF NOT EXISTS interpretation_rate_idx ON ai_interpretation(workspace_id,created_at);
ALTER TABLE knowledge_intake ADD COLUMN IF NOT EXISTS interpretation_id text REFERENCES ai_interpretation(id);

-- P1 is additive: legacy reviewed means personal review, never external approval.
CREATE TABLE IF NOT EXISTS content_workflow(
 workspace_id text NOT NULL, content_id text NOT NULL, version integer NOT NULL,
 state text NOT NULL CHECK(state IN('draft','pending','approved','changes_requested')),
 updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(workspace_id,content_id),
 FOREIGN KEY(workspace_id,content_id) REFERENCES content(workspace_id,id),
 FOREIGN KEY(content_id,version) REFERENCES content_version(content_id,version));
CREATE TABLE IF NOT EXISTS review_event(
 id text PRIMARY KEY,workspace_id text NOT NULL,content_id text NOT NULL,version integer NOT NULL,
 action text NOT NULL CHECK(action IN('submit','approve','request_changes','withdraw','invalidate')),
 note text NOT NULL DEFAULT '',actor_id text NOT NULL REFERENCES auth_user(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,content_id) REFERENCES content(workspace_id,id),
 FOREIGN KEY(content_id,version) REFERENCES content_version(content_id,version));
CREATE TABLE IF NOT EXISTS media_job(
 id text PRIMARY KEY,workspace_id text NOT NULL,content_id text NOT NULL,version integer NOT NULL,
 asset_id text NOT NULL,request_key text NOT NULL,request_hash text NOT NULL,
 status text NOT NULL CHECK(status IN('running','succeeded','failed')),
 manifest jsonb NOT NULL DEFAULT '{}',error_code text,created_by text NOT NULL REFERENCES auth_user(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,request_key),
 FOREIGN KEY(workspace_id,content_id) REFERENCES content(workspace_id,id),
 FOREIGN KEY(content_id,version) REFERENCES content_version(content_id,version),
 FOREIGN KEY(workspace_id,asset_id) REFERENCES asset(workspace_id,id));
CREATE INDEX IF NOT EXISTS review_content_idx ON review_event(workspace_id,content_id,created_at);
CREATE INDEX IF NOT EXISTS media_workspace_idx ON media_job(workspace_id,created_at);
