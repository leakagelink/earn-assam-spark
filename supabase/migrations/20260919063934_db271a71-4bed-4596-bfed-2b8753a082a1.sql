REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.become_provider(text,text,uuid,text,uuid,uuid,uuid,integer,numeric,text,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_kyc(text,text,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.review_kyc(uuid,boolean,text) FROM authenticated;