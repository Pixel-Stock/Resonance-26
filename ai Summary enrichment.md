What are the Problems with the current AI Summary is written below:

Here are the core problems with it:
1. Wall-of-text paragraphs — Critical info like affected servers, timestamps, and scores are buried mid-sentence. Your eyes have to hunt for them.
2. ISO timestamps everywhere — 2026-04-11T00:02:08+00:00 is machine format, not human format.
3. Technical Details just repeats the summary — It's the same information said twice in a slightly different way. Redundant.
4. Affected systems should be tags/chips — Listing bastion-01, prod-app-01, prod-web-01... inline in a sentence is hard to count and scan.
5. Risk scores are mentioned casually — 0.2701 and 0.2686 appear in a paragraph with zero visual weight despite being key indicators.


Key changes to make:

Metric cards at the top — host count, threat type, and risk score are immediately visible without reading a paragraph
Host chips — all 5 servers are scannable tags, not buried in a sentence
ISO timestamps cleaned up — 00:02 – 00:32 UTC instead of 2026-04-11T00:02:08+00:00
Technical Details is now a key-value table — no repeated prose, just the facts
MITM badge — highlights the threat type inline without making it a wall of text
Executive summary is one short sentence — not three overlapping ones