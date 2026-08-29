-- Read-only inventory of descriptions created by the retired four-template backfill.
-- The rebuilt profile page suppresses these descriptions automatically.
-- This script changes nothing.

select
  id,
  slug,
  trading_name,
  area,
  about,
  case
    when about ~* ' serves homeowners and small businesses in .+KwaZulu-Natal, offering ' then 'template_1'
    when about ~* '^Operating across .+ and the surrounding KZN region, .+ specialises in ' then 'template_2'
    when about ~* ' is a (PIRB-certified|verified) plumbing business based in .+KwaZulu-Natal\. Services include ' then 'template_3'
    when about ~* '^Based in .+, .+ has been providing .+ to homes and businesses in KwaZulu-Natal\.' then 'template_4'
    when about ~* '(offering|services include)\s*\.' then 'malformed_template'
    else 'review'
  end as template_match
from public.plumbers
where about ~* ' serves homeowners and small businesses in .+KwaZulu-Natal, offering '
   or about ~* '^Operating across .+ and the surrounding KZN region, .+ specialises in '
   or about ~* ' is a (PIRB-certified|verified) plumbing business based in .+KwaZulu-Natal\. Services include '
   or about ~* '^Based in .+, .+ has been providing .+ to homes and businesses in KwaZulu-Natal\.'
   or about ~* '(offering|services include)\s*\.'
order by trading_name;
