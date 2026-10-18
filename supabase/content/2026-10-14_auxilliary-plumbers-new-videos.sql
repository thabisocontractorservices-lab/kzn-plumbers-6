-- Replaces the removed YouTube video in the Auxilliary Plumbers article with the two new videos (Part 1 and Part 2).
-- Only the video section changes; the rest of the article is left as it is.
-- Safe to run more than once.
-- Supabase → SQL Editor → New query → paste EVERYTHING below → Run.

do $$
declare
  v_slug text := 'durban-plumbing-icon-fights-back-against-digital-extortion';
  v_new  text := $html$<h2>Watch: how the Google reviews extortion scam works</h2>
<p><em>Part 1</em></p>
<figure class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/gz9hEm4kV8k" title="Google Reviews Extortion: How the New Scam Works, Part 1 (Auxilliary Plumbers)" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>
<p><em>Part 2</em></p>
<figure class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/VFfN6gQZWNk" title="Google Reviews Extortion: How the New Scam Works, Part 2 (Auxilliary Plumbers)" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></figure>
<p><em>Videos: Auxilliary Plumbers on YouTube.</em></p>$html$;
  v_body text;
  v_updated text;
begin
  select body into v_body from public.articles where slug = v_slug;
  if v_body is null then
    raise exception 'Article % not found. Run the original 2026-10-09 article script first.', v_slug;
  end if;

  -- Remove the old video block (figure + its caption line), wherever it is.
  v_updated := regexp_replace(v_body,
    '<figure class="video-embed"><iframe src="https://www\.youtube-nocookie\.com/embed/ADewLwTbX9c"[^<]*></iframe></figure>\s*(<p><em>Watch:[^<]*</em></p>)?',
    '', 'g');

  -- Remove any previous run of this script so it never duplicates.
  v_updated := regexp_replace(v_updated,
    '<h2>Watch: how the Google reviews extortion scam works</h2>.*?<p><em>Videos: Auxilliary Plumbers on YouTube\.</em></p>',
    '', 'g');

  -- Insert the new videos straight after the opening "DURBAN, SOUTH AFRICA" paragraph.
  if v_updated ~ '<p><strong>DURBAN, SOUTH AFRICA</strong>.*?</p>' then
    v_updated := regexp_replace(v_updated, '(<p><strong>DURBAN, SOUTH AFRICA</strong>.*?</p>)', E'\\1\n\n' || v_new);
  else
    -- Fallback: put them before "What happened", or at the end.
    if position('<h2>What happened</h2>' in v_updated) > 0 then
      v_updated := replace(v_updated, '<h2>What happened</h2>', v_new || E'\n\n<h2>What happened</h2>');
    else
      v_updated := v_updated || E'\n\n' || v_new;
    end if;
  end if;

  -- The old meta description said "Watch the video."; make it plural.
  update public.articles
     set body = v_updated,
         meta_description = replace(coalesce(meta_description, ''), 'Watch the video.', 'Watch the videos.')
   where slug = v_slug;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articles' and column_name = 'updated_at') then
    execute 'update public.articles set updated_at = now() where slug = $1' using v_slug;
  end if;
end $$;

-- Check: old_video should be false, part1 and part2 true
select position('ADewLwTbX9c' in body) > 0 as old_video,
       position('gz9hEm4kV8k' in body) > 0 as part1,
       position('VFfN6gQZWNk' in body) > 0 as part2
from public.articles
where slug = 'durban-plumbing-icon-fights-back-against-digital-extortion';
