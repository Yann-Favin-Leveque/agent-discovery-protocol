-- Migration: Add detail_json column to capabilities table
-- This stores the full CapabilityDetail JSON (endpoint, method, parameters, etc.)
-- for services that don't implement their own /.well-known/agent capability detail endpoints.

ALTER TABLE capabilities ADD COLUMN IF NOT EXISTS detail_json JSONB;
