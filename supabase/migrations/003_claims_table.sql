-- ============================================================
-- CLAIMS TABLE — tracks listing claim requests from plumbers
-- Run this in Supabase Studio → SQL Editor
-- ============================================================

-- 1. Create claims table
CREATE TABLE IF NOT EXISTS public.claims (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plumber_id  uuid NOT NULL REFERENCES public.plumbers(id) ON DELETE CASCADE,
  claimant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone_entered text NOT NULL,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'auto_approved', 'approved', 'rejected')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  admin_notes text
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_claims_plumber_id ON public.claims(plumber_id);
CREATE INDEX IF NOT EXISTS idx_claims_claimant_id ON public.claims(claimant_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON public.claims(status);

-- 3. Enable RLS
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies

-- Users can view their own claims
CREATE POLICY "Users can view own claims"
  ON public.claims FOR SELECT
  USING (auth.uid() = claimant_id);

-- Users can insert their own claims
CREATE POLICY "Users can insert own claims"
  ON public.claims FOR INSERT
  WITH CHECK (auth.uid() = claimant_id);

-- Admins can do everything
CREATE POLICY "Admins full access on claims"
  ON public.claims FOR ALL
  USING (public.is_admin());

-- 5. Comment
COMMENT ON TABLE public.claims IS 'Tracks plumber listing claim requests. Auto-approved when phone matches, otherwise pending admin review.';
