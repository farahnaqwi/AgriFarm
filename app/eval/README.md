# Speech recognition evaluation

Measures word error rate (WER) of the on-device model (whisper-tiny q8) on Swahili speech.

## Result (run on 4 Oct 2026)
- Data: FLEURS Swahili (Kenya) test set, 50 distinct sentences, one speaker each. Read news-style text, not farm speech.
- Model: whisper-tiny q8, run in Node (not the browser), max_new_tokens 80, no_repeat_ngram_size 3.
- Word error rate: 105.2%
- Character error rate: 63.0%
- Exact matches: 0/50. Median per-clip WER: 100%. Clips with WER <= 0.5: 0/50.
- Conclusion: raw whisper-tiny is not accurate for Swahili. It garbles words, loops on some clips and drifts to English on others. This is why extract.ts uses fuzzy correction and the farmer confirms every value by tap.
- This is not the app's claim-level accuracy, which is a different measurement.

## Reproduce
1. In app/: `npm install`, then `npm run fetch-models`.
2. Download FLEURS sw_ke (test.tsv and audio/test.tar.gz from huggingface.co/datasets/google/fleurs) into eval/fleurs and extract.
3. Put 50 clips in eval/clips and write eval/refs.tsv (file name, Tab, reference text).
4. Convert to 16 kHz mono: `ffmpeg -y -i in.wav -ar 16000 -ac 1 -c:a pcm_s16le eval/clips16/in.wav`
5. From app/: `node eval/wer.mjs`