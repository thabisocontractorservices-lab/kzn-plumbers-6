-- Adds the Auxilliary Plumbers media release to the blog (/blog/durban-plumbing-icon-fights-back-against-digital-extortion).
-- Safe to run more than once: if the article already exists it is updated, not duplicated.
-- Supabase → SQL Editor → New query → paste EVERYTHING below → Run.

do $$
declare
  v_slug  text := 'durban-plumbing-icon-fights-back-against-digital-extortion';
  v_title text := 'Durban Plumbing Icon Fights Back Against Digital Extortion';
  v_meta_title text := 'Durban Plumber Fights Fake-Review Extortion | KZN Plumbers';
  v_meta_desc  text := 'Auxilliary Plumbers, a 100-year-old Durban family business, reported a WhatsApp extortion attempt linked to fake Google reviews to SAPS. Watch the video.';
  v_keywords text[] := array['Auxilliary Plumbers', 'fake Google reviews', 'review extortion', 'WhatsApp scam', 'Durban plumber', 'cybercrime South Africa', 'SAPS'];
  v_body text := $body$
<p><em>Media release from Auxilliary Plumbers, a KZN Plumbers Directory member. For immediate release.</em></p>

<p><strong>DURBAN, SOUTH AFRICA</strong> — Auxilliary Plumbers, a third-generation family business with a century-long legacy in KwaZulu-Natal, has taken a definitive stand against cybercrime. Following a targeted digital attack in September 2026, CEO Hunter-Robert Schmidt has officially escalated a WhatsApp extortion attempt to the South African Police Service (SAPS), drawing a firm line against online reputation theft.</p>

<figure class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/ADewLwTbX9c" title="Auxilliary Plumbers on the extortion attempt (YouTube)" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>
<p><em>Watch: Auxilliary Plumbers' video statement, 2 October 2026.</em></p>

<h2>What happened</h2>
<p>The incident unfolded when the company's highly rated Google Business Profile was suddenly hit by a wave of unverified, fraudulent reviews. Shortly after, Schmidt was contacted via WhatsApp by an anonymous extortionist demanding a cash payout to remove the negative ratings.</p>
<p>Refusing to compromise the operational integrity his family spent over 100 years building, Schmidt declined the demands and immediately opened a criminal case with the local authorities.</p>

<blockquote><p>"Our reputation is built on hard work, late-night emergency calls, and honest service—not blackmail," says Hunter Schmidt, CEO of Auxilliary Plumbers. "Paying off cyber-criminals only fuels the cycle. We believe in transparency, and we trust our long-standing Durban footprint speaks louder than fake online noise. Remember, Google is the best thing since bread came sliced, but only when it's used honestly."</p></blockquote>

<h2>Business as usual</h2>
<p>Auxilliary Plumbers continues to operate at full capacity, providing 24/7/365 rapid-response plumbing infrastructure support to domestic, commercial, and industrial clients across Durban North, Umhlanga, and surrounding areas.</p>

<h2>If this happens to your business</h2>
<ul>
<li><strong>Don't pay.</strong> Paying rarely makes fake reviews go away and marks your business as a target.</li>
<li><strong>Keep the evidence.</strong> Screenshot the WhatsApp messages, the sender's number and every suspicious review with its date.</li>
<li><strong>Report it.</strong> Open a case at your local SAPS station, and report the reviews to Google through your Business Profile ("Manage reviews" → report review).</li>
<li><strong>Tell your customers.</strong> A short, honest reply under the fake reviews helps real customers see what is going on.</li>
</ul>

<h2>Media contact</h2>
<ul>
<li>Contact person: Hunter Schmidt (CEO), Auxilliary Plumbers</li>
<li>Phone: <a href="tel:+27725425577">072 542 5577</a></li>
<li>YouTube: <a href="https://www.youtube.com/@AuxilliaryPlumbers" target="_blank" rel="noopener noreferrer">Auxilliary Plumbers</a></li>
</ul>
<p><em>This media release was supplied by Auxilliary Plumbers and is published as received. Statements and allegations are those of the company. KZN Plumbers Directory has not independently verified the reviews or the police case.</em></p>
$body$;
  v_words integer;
begin
  v_words := array_length(regexp_split_to_array(trim(regexp_replace(v_body, '<[^>]+>', ' ', 'g')), '\s+'), 1);

  if exists (select 1 from public.articles where slug = v_slug) then
    update public.articles
       set title = v_title, meta_title = v_meta_title, meta_description = v_meta_desc,
           body = v_body, keywords = v_keywords, word_count = v_words
     where slug = v_slug;
  else
    insert into public.articles (title, slug, meta_title, meta_description, body, keywords, publish_date, word_count)
    values (v_title, v_slug, v_meta_title, v_meta_desc, v_body, v_keywords, now(), v_words);
  end if;

  -- Some databases have extra publishing columns. Set them only if they exist.
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articles' and column_name = 'published') then
    execute 'update public.articles set published = true where slug = $1' using v_slug;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articles' and column_name = 'status') then
    execute 'update public.articles set status = ''published'' where slug = $1' using v_slug;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articles' and column_name = 'updated_at') then
    execute 'update public.articles set updated_at = now() where slug = $1' using v_slug;
  end if;
end $$;

-- Check it worked (should show 1 row):
select slug, title, publish_date, word_count from public.articles
where slug = 'durban-plumbing-icon-fights-back-against-digital-extortion';
