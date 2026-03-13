CREATE TABLE IF NOT EXISTS app.optimization_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  rota_id INTEGER NOT NULL REFERENCES app.rotas(id) ON DELETE CASCADE,
  operation_profile TEXT NOT NULL DEFAULT 'route_optimization',
  stop_count INTEGER NOT NULL,
  ordered_input BOOLEAN NOT NULL DEFAULT false,
  strategy_selected TEXT NOT NULL,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  fallback_strategy TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  error_message TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_requests_rota
  ON app.optimization_requests (rota_id);

CREATE INDEX IF NOT EXISTS idx_optimization_requests_tenant
  ON app.optimization_requests (tenant_id);

CREATE TABLE IF NOT EXISTS app.optimization_results (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES app.optimization_requests(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'mapbox',
  strategy_used TEXT NOT NULL,
  input_stops JSONB NOT NULL,
  output_order JSONB NOT NULL,
  geometry JSONB,
  distance_total REAL,
  duration_total REAL,
  quality_score REAL,
  response_time_ms INTEGER NOT NULL,
  raw_response JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_results_request
  ON app.optimization_results (request_id);
