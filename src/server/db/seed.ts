import bcrypt from 'bcryptjs';
import type { DatabaseAdapter } from './adapter.js';
import { lrcToTtml } from '../services/ttml.util.js';

export async function seedDatabase(db: DatabaseAdapter, forceAdmin: boolean = false): Promise<void> {
  const isPg = db.type === 'postgres';
  const isMysql = db.type === 'mysql';
  const isSqlite = db.type === 'sqlite';

  const stringify = (val: any) => {
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  };

  // 1. Ensure node tables exist
  await db.createNodeTable('akai');
  await db.createNodeTable('pine');
  await db.createNodeTable('pakai');

  // 2. Check if nodes already exist
  const existingNodes = await db.query('SELECT node_id FROM nodes');
  if (existingNodes.length === 0) {
    const nodes = [
      {
        node_id: 'akai',
        name: 'Akai ✦ Eastern & Anime Archive',
        description: 'Primary Japanese, Anime, Vocaloid, J-Pop and J-Rock lyrics partition with full Romaji, Kanji, and Apple Music TTML syllable-by-syllable synchronization.',
        table_name: 'lyrics_akai',
        storage_mode: 'isolated_table',
        is_nsfw: false,
        status: 'active',
        rate_limit: 180,
        total_records_approx: 280000,
        about_config: stringify({
          tagline: 'The premier East Asian & Anime synchronized lyrics repository.',
          maintainer: 'Akai Curation Team',
          contact: 'akai-node@semar.internal',
          languages: ['Japanese', 'Romaji', 'Korean', 'Chinese'],
          curationRules: 'Romaji must follow Hepburn romanization. Kanji and Furigana preferred in synced TTML/LRC payload.',
          syncStandard: 'Apple Music TTML Syllable-by-Syllable + Enhanced LRC.',
          bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=80',
          stats: { verifiedSyncRatio: '99.4%', activeCurators: 42, dailyQueries: '1.2M' },
        }),
        api_config: stringify({
          allowedOrigins: ['*'],
          customHeaders: { 'X-Node-Name': 'Semar-Akai-v2', 'X-Node-Engine': 'IsolatedPostgresPartition' },
          cacheTtlSeconds: 86400,
        }),
      },
      {
        node_id: 'pine',
        name: 'PiNE 🌲 Global Hits & Modern Catalog',
        description: 'High-capacity global lyrics database hosting worldwide pop, rock, hip-hop, electronic, and indie tracks with word-by-word TTML and LRC sync.',
        table_name: 'lyrics_pine',
        storage_mode: 'isolated_table',
        is_nsfw: false,
        status: 'active',
        rate_limit: 300,
        total_records_approx: 500000,
        about_config: stringify({
          tagline: 'High-throughput global music lyrics engine.',
          maintainer: 'PiNE Global Music Foundation',
          contact: 'pine-core@semar.internal',
          languages: ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Global'],
          curationRules: 'Clean punctuation, explicit tags verified, word-by-word and line-by-line sync timestamps supported.',
          syncStandard: 'Apple Music TTML + Standard LRC.',
          bannerUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
          stats: { verifiedSyncRatio: '98.9%', activeCurators: 128, dailyQueries: '4.8M' },
        }),
        api_config: stringify({
          allowedOrigins: ['*'],
          customHeaders: { 'X-Node-Name': 'Semar-PiNE-v2', 'X-Node-Engine': 'IsolatedPostgresPartition' },
          cacheTtlSeconds: 86400,
        }),
      },
      {
        node_id: 'pakai',
        name: 'PAKAI 🔞 Underground & Mature Vault',
        description: 'Isolated mature/NSFW lyrics namespace for underground hip-hop, explicit parodies, heavy metal, and subversive audio culture.',
        table_name: 'lyrics_pakai',
        storage_mode: 'isolated_table',
        is_nsfw: true,
        status: 'active',
        rate_limit: 100,
        total_records_approx: 3000,
        about_config: stringify({
          tagline: 'Uncensored underground & explicit audio lyrics partition.',
          maintainer: 'PAKAI Underground Collective',
          contact: 'pakai-vault@semar.internal',
          languages: ['Multilingual', 'Underground Slang', 'Raw'],
          curationRules: 'Age-verification required (18+). Contains raw transcripts, explicit language, and adult themes.',
          syncStandard: 'Standard TTML & LRC.',
          bannerUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=1200&q=80',
          stats: { verifiedSyncRatio: '94.2%', activeCurators: 18, dailyQueries: '85k' },
        }),
        api_config: stringify({
          allowedOrigins: ['*'],
          customHeaders: { 'X-Node-Name': 'Semar-PAKAI-NSFW', 'X-Node-Engine': 'IsolatedPartition-Restricted' },
          cacheTtlSeconds: 43200,
        }),
      },
    ];

    for (const node of nodes) {
      await db.execute(
        `INSERT INTO nodes (node_id, name, description, table_name, storage_mode, is_nsfw, status, rate_limit, total_records_approx, about_config, api_config)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          node.node_id,
          node.name,
          node.description,
          node.table_name,
          node.storage_mode,
          node.is_nsfw ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false),
          node.status,
          node.rate_limit,
          node.total_records_approx,
          node.about_config,
          node.api_config,
        ]
      );
    }
  }

  // 3. Seed sample lyrics into Akai
  const akaiCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM lyrics_akai');
  if (!akaiCount || Number(akaiCount.count) === 0) {
    const akaiSongs = [
      {
        title: 'Gurenge (紅蓮華)',
        artist: 'LiSA',
        album: 'LEO-NiNE / Demon Slayer OP',
        youtube_video_id: 'CwkzK-Fh400',
        duration: 238,
        plain_lyrics: `Tsuyoku nareru riyuu wo shitta\nBoku wo tsurete susume\n\nDorodarake no soumatou ni you\nKowabaru kokoro furueru te wa\nTsukamitai mono ga aru\nSore dake sa\n\nYoru no nioi ni sora nirandemo\nKawatte ikeru no wa jibun jishin dake\nSore dake sa\n\nTsuyoku nareru riyuu wo shitta\nBoku wo tsurete susume\n\nDou shitatte kesenai yume mo tomarenai ima mo\nDareka no tame ni tsuyoku nareru nara\nArigatou kanashimi yo\nSekai ni uchinomesarete makeru imi wo shitta\n紅蓮の華よ咲き誇れ 運命を照らして`,
        synced_lyrics: `[00:00.00]LiSA - Gurenge (Demon Slayer: Kimetsu no Yaiba OP)
[00:04.12]Tsuyoku nareru riyuu wo shitta
[00:08.85]Boku wo tsurete susume
[00:13.40]♪
[00:27.15]Dorodarake no soumatou ni you
[00:30.90]Kowabaru kokoro furueru te wa
[00:34.50]Tsukamitai mono ga aru
[00:37.20]Sore dake sa
[00:40.40]Yoru no nioi ni sora nirandemo
[00:44.80]Kawatte ikeru no wa jibun jishin dake
[00:48.50]Sore dake sa
[00:52.30]Tsuyoku nareru riyuu wo shitta
[00:56.80]Boku wo tsurete susume
[01:02.10]Dou shitatte kesenai yume mo tomarenai ima mo
[01:07.40]Dareka no tame ni tsuyoku nareru nara
[01:12.60]Arigatou kanashimi yo
[01:15.90]Sekai ni uchinomesarete makeru imi wo shitta
[01:21.80]Guren no hana yo sakihokore
[01:27.50]Unmei wo terashite`,
        ttml_lyrics: `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" xmlns:itunes="http://music.apple.com/lyric-ttml-extensions">
  <head>
    <metadata>
      <ttm:title>Gurenge (紅蓮華)</ttm:title>
      <ttm:agent type="person" xml:id="v1">LiSA</ttm:agent>
    </metadata>
  </head>
  <body dur="00:03:58.000">
    <div>
      <p begin="00:04.120" end="00:08.850" ttm:agent="v1">
        <span begin="00:04.120" end="00:05.100">Tsuyoku </span>
        <span begin="00:05.100" end="00:06.200">nareru </span>
        <span begin="00:06.200" end="00:07.400">riyuu </span>
        <span begin="00:07.400" end="00:07.900">wo </span>
        <span begin="00:07.900" end="00:08.850">shitta</span>
      </p>
      <p begin="00:08.850" end="00:13.400" ttm:agent="v1">
        <span begin="00:08.850" end="00:09.900">Boku </span>
        <span begin="00:09.900" end="00:10.500">wo </span>
        <span begin="00:10.500" end="00:11.800">tsurete </span>
        <span begin="00:11.800" end="00:13.400">susume</span>
      </p>
      <p begin="00:27.150" end="00:30.900" ttm:agent="v1">
        <span begin="00:27.150" end="00:28.400">Dorodarake </span>
        <span begin="00:28.400" end="00:29.100">no </span>
        <span begin="00:29.100" end="00:30.100">soumatou </span>
        <span begin="00:30.100" end="00:30.500">ni </span>
        <span begin="00:30.500" end="00:30.900">you</span>
      </p>
      <p begin="00:30.900" end="00:34.500" ttm:agent="v1">
        <span begin="00:30.900" end="00:32.000">Kowabaru </span>
        <span begin="00:32.000" end="00:32.800">kokoro </span>
        <span begin="00:32.800" end="00:33.800">furueru </span>
        <span begin="00:33.800" end="00:34.100">te </span>
        <span begin="00:34.100" end="00:34.500">wa</span>
      </p>
      <p begin="00:34.500" end="00:37.200" ttm:agent="v1">
        <span begin="00:34.500" end="00:35.800">Tsukamitai </span>
        <span begin="00:35.800" end="00:36.400">mono </span>
        <span begin="00:36.400" end="00:36.700">ga </span>
        <span begin="00:36.700" end="00:37.200">aru</span>
      </p>
      <p begin="00:37.200" end="00:40.400" ttm:agent="v1">
        <span begin="00:37.200" end="00:38.200">Sore </span>
        <span begin="00:38.200" end="00:39.100">dake </span>
        <span begin="00:39.100" end="00:40.400">sa</span>
      </p>
      <p begin="00:40.400" end="00:44.800" ttm:agent="v1">
        <span begin="00:40.400" end="00:41.500">Yoru </span>
        <span begin="00:41.500" end="00:41.900">no </span>
        <span begin="00:41.900" end="00:42.800">nioi </span>
        <span begin="00:42.800" end="00:43.200">ni </span>
        <span begin="00:43.200" end="00:44.000">sora </span>
        <span begin="00:44.000" end="00:44.800">nirandemo</span>
      </p>
      <p begin="00:44.800" end="00:48.500" ttm:agent="v1">
        <span begin="00:44.800" end="00:45.900">Kawatte </span>
        <span begin="00:45.900" end="00:46.800">ikeru </span>
        <span begin="00:46.800" end="00:47.100">no </span>
        <span begin="00:47.100" end="00:47.400">wa </span>
        <span begin="00:47.400" end="00:48.000">jibun </span>
        <span begin="00:48.000" end="00:48.300">jishin </span>
        <span begin="00:48.300" end="00:48.500">dake</span>
      </p>
      <p begin="00:52.300" end="00:56.800" ttm:agent="v1">
        <span begin="00:52.300" end="00:53.400">Tsuyoku </span>
        <span begin="00:53.400" end="00:54.600">nareru </span>
        <span begin="00:54.600" end="00:55.700">riyuu </span>
        <span begin="00:55.700" end="00:56.100">wo </span>
        <span begin="00:56.100" end="00:56.800">shitta</span>
      </p>
      <p begin="00:56.800" end="01:02.100" ttm:agent="v1">
        <span begin="00:56.800" end="00:57.900">Boku </span>
        <span begin="00:57.900" end="00:58.500">wo </span>
        <span begin="00:58.500" end="00:59.800">tsurete </span>
        <span begin="00:59.800" end="01:02.100">susume</span>
      </p>
      <p begin="01:02.100" end="01:07.400" ttm:agent="v1">
        <span begin="01:02.100" end="01:03.500">Dou </span>
        <span begin="01:03.500" end="01:04.600">shitatte </span>
        <span begin="01:04.600" end="01:05.800">kesenai </span>
        <span begin="01:05.800" end="01:06.600">yume </span>
        <span begin="01:06.600" end="01:07.000">mo </span>
        <span begin="01:07.000" end="01:07.400">tomarenai </span>
        <span begin="01:07.400" end="01:07.400">ima </span>
        <span begin="01:07.400" end="01:07.400">mo</span>
      </p>
      <p begin="01:07.400" end="01:12.600" ttm:agent="v1">
        <span begin="01:07.400" end="01:08.800">Dareka </span>
        <span begin="01:08.800" end="01:09.300">no </span>
        <span begin="01:09.300" end="01:10.100">tame </span>
        <span begin="01:10.100" end="01:10.400">ni </span>
        <span begin="01:10.400" end="01:11.400">tsuyoku </span>
        <span begin="01:11.400" end="01:12.100">nareru </span>
        <span begin="01:12.100" end="01:12.600">nara</span>
      </p>
      <p begin="01:12.600" end="01:15.900" ttm:agent="v1">
        <span begin="01:12.600" end="01:13.800">Arigatou </span>
        <span begin="01:13.800" end="01:14.900">kanashimi </span>
        <span begin="01:14.900" end="01:15.900">yo</span>
      </p>
      <p begin="01:15.900" end="01:21.800" ttm:agent="v1">
        <span begin="01:15.900" end="01:17.100">Sekai </span>
        <span begin="01:17.100" end="01:17.500">ni </span>
        <span begin="01:17.500" end="01:19.000">uchinomesarete </span>
        <span begin="01:19.000" end="01:20.100">makeru </span>
        <span begin="01:20.100" end="01:20.800">imi </span>
        <span begin="01:20.800" end="01:21.200">wo </span>
        <span begin="01:21.200" end="01:21.800">shitta</span>
      </p>
      <p begin="01:21.800" end="01:27.500" ttm:agent="v1">
        <span begin="01:21.800" end="01:23.200">Guren </span>
        <span begin="01:23.200" end="01:23.600">no </span>
        <span begin="01:23.600" end="01:24.400">hana </span>
        <span begin="01:24.400" end="01:24.800">yo </span>
        <span begin="01:24.800" end="01:26.100">sakihokore</span>
      </p>
      <p begin="01:27.500" end="01:32.000" ttm:agent="v1">
        <span begin="01:27.500" end="01:29.200">Unmei </span>
        <span begin="01:29.200" end="01:29.800">wo </span>
        <span begin="01:29.800" end="01:32.000">terashite</span>
      </p>
    </div>
  </body>
</tt>`,
        metadata: stringify({
          anime: 'Demon Slayer: Kimetsu no Yaiba',
          season: 'Season 1',
          source: 'Sony Music / Sacra Music',
          language: 'ja-JP',
          bpm: 135,
          key: 'E Minor',
          composer: 'Kayoko Kusano',
          hasTtml: true,
          hasSyllableSync: true,
        }),
        is_explicit: false,
        views_count: 142050,
      },
      {
        title: 'Idol (アイドル)',
        artist: 'YOASOBI',
        album: 'THE BOOK 3 / Oshi no Ko OP',
        youtube_video_id: 'ZRtdQ81jPUQ',
        duration: 213,
        plain_lyrics: `Muteki no egao de arasu media\nShiritai sono himitsu misuteriasu\nNuketeru toko sae kanojo no eria\nKanpeki de usotsuki na kimi wa\nTensai teki na aidoru sama`,
        synced_lyrics: `[00:00.00]YOASOBI - Idol (Oshi no Ko OP)
[00:03.50]Muteki no egao de arasu media
[00:06.80]Shiritai sono himitsu misuteriasu
[00:10.20]Nuketeru toko sae kanojo no eria
[00:13.60]Kanpeki de usotsuki na kimi wa
[00:16.80]Tensai teki na aidoru sama`,
        ttml_lyrics: `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:title>Idol (アイドル)</ttm:title>
      <ttm:agent type="person" xml:id="v1">YOASOBI</ttm:agent>
    </metadata>
  </head>
  <body dur="00:03:33.000">
    <div>
      <p begin="00:03.500" end="00:06.800" ttm:agent="v1">
        <span begin="00:03.500" end="00:04.200">Muteki </span>
        <span begin="00:04.200" end="00:04.500">no </span>
        <span begin="00:04.500" end="00:05.300">egao </span>
        <span begin="00:05.300" end="00:05.600">de </span>
        <span begin="00:05.600" end="00:06.100">arasu </span>
        <span begin="00:06.100" end="00:06.800">media</span>
      </p>
      <p begin="00:06.800" end="00:10.200" ttm:agent="v1">
        <span begin="00:06.800" end="00:07.800">Shiritai </span>
        <span begin="00:07.800" end="00:08.300">sono </span>
        <span begin="00:08.300" end="00:09.100">himitsu </span>
        <span begin="00:09.100" end="00:10.200">misuteriasu</span>
      </p>
      <p begin="00:10.200" end="00:13.600" ttm:agent="v1">
        <span begin="00:10.200" end="00:11.400">Nuketeru </span>
        <span begin="00:11.400" end="00:11.900">toko </span>
        <span begin="00:11.900" end="00:12.300">sae </span>
        <span begin="00:12.300" end="00:12.800">kanojo </span>
        <span begin="00:12.800" end="00:13.100">no </span>
        <span begin="00:13.100" end="00:13.600">eria</span>
      </p>
      <p begin="00:13.600" end="00:16.800" ttm:agent="v1">
        <span begin="00:13.600" end="00:14.600">Kanpeki </span>
        <span begin="00:14.600" end="00:14.900">de </span>
        <span begin="00:14.900" end="00:15.800">usotsuki </span>
        <span begin="00:15.800" end="00:16.100">na </span>
        <span begin="00:16.100" end="00:16.500">kimi </span>
        <span begin="00:16.500" end="00:16.800">wa</span>
      </p>
      <p begin="00:16.800" end="00:20.100" ttm:agent="v1">
        <span begin="00:16.800" end="00:17.600">Tensai </span>
        <span begin="00:17.600" end="00:18.300">teki </span>
        <span begin="00:18.300" end="00:18.600">na </span>
        <span begin="00:18.600" end="00:19.400">aidoru </span>
        <span begin="00:19.400" end="00:20.100">sama</span>
      </p>
    </div>
  </body>
</tt>`,
        metadata: stringify({ anime: 'Oshi no Ko', composer: 'Ayase', vocal: 'ikura', hasTtml: true }),
        is_explicit: false,
        views_count: 312000,
      },
    ];

    for (const song of akaiSongs) {
      const ttml = song.ttml_lyrics || lrcToTtml(song.synced_lyrics, song.title, song.artist, song.duration);
      await db.execute(
        `INSERT INTO lyrics_akai (title, artist, album, youtube_video_id, duration, plain_lyrics, synced_lyrics, ttml_lyrics, metadata, is_explicit, views_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          song.title,
          song.artist,
          song.album,
          song.youtube_video_id,
          song.duration,
          song.plain_lyrics,
          song.synced_lyrics,
          ttml,
          song.metadata,
          song.is_explicit ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false),
          song.views_count,
        ]
      );
    }
  }

  // 4. Seed sample lyrics into PiNE
  const pineCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM lyrics_pine');
  if (!pineCount || Number(pineCount.count) === 0) {
    const pineSongs = [
      {
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        youtube_video_id: '4NRXx6U8ABQ',
        duration: 200,
        plain_lyrics: `Yeah\nI've been tryna call\nI've been on my own for long enough\nMaybe you can show me how to love, maybe\n\nI'm going through withdrawals\nYou don't even have to do too much\nYou can turn me on with just a touch, baby\n\nI look around and Sin City's cold and empty\nNo one's around to judge me\nI can't see clearly when you're gone\n\nI said, ooh, I'm blinded by the lights\nNo, I can't sleep until I feel your touch\nI said, ooh, I'm drowning in the night\nOh, when I'm like this, you're the one I trust`,
        synced_lyrics: `[00:00.00]The Weeknd - Blinding Lights
[00:12.50]Yeah
[00:14.20]I've been tryna call
[00:17.80]I've been on my own for long enough
[00:21.50]Maybe you can show me how to love, maybe
[00:27.80]I'm going through withdrawals
[00:31.50]You don't even have to do too much
[00:35.20]You can turn me on with just a touch, baby
[00:41.80]I look around and Sin City's cold and empty
[00:46.50]No one's around to judge me
[00:49.80]I can't see clearly when you're gone
[00:54.20]I said, ooh, I'm blinded by the lights
[00:59.80]No, I can't sleep until I feel your touch
[01:05.40]I said, ooh, I'm drowning in the night
[01:11.20]Oh, when I'm like this, you're the one I trust`,
        ttml_lyrics: `<?xml version="1.0" encoding="UTF-8"?>
<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata">
  <head>
    <metadata>
      <ttm:title>Blinding Lights</ttm:title>
      <ttm:agent type="person" xml:id="v1">The Weeknd</ttm:agent>
    </metadata>
  </head>
  <body dur="00:03:20.000">
    <div>
      <p begin="00:12.500" end="00:14.200" ttm:agent="v1">
        <span begin="00:12.500" end="00:14.200">Yeah </span>
      </p>
      <p begin="00:14.200" end="00:17.800" ttm:agent="v1">
        <span begin="00:14.200" end="00:15.000">I've </span>
        <span begin="00:15.000" end="00:15.800">been </span>
        <span begin="00:15.800" end="00:16.800">tryna </span>
        <span begin="00:16.800" end="00:17.800">call </span>
      </p>
      <p begin="00:17.800" end="00:21.500" ttm:agent="v1">
        <span begin="00:17.800" end="00:18.400">I've </span>
        <span begin="00:18.400" end="00:18.900">been </span>
        <span begin="00:18.900" end="00:19.400">on </span>
        <span begin="00:19.400" end="00:19.800">my </span>
        <span begin="00:19.800" end="00:20.400">own </span>
        <span begin="00:20.400" end="00:20.800">for </span>
        <span begin="00:20.800" end="00:21.100">long </span>
        <span begin="00:21.100" end="00:21.500">enough </span>
      </p>
      <p begin="00:21.500" end="00:27.800" ttm:agent="v1">
        <span begin="00:21.500" end="00:22.400">Maybe </span>
        <span begin="00:22.400" end="00:23.000">you </span>
        <span begin="00:23.000" end="00:23.500">can </span>
        <span begin="00:23.500" end="00:24.200">show </span>
        <span begin="00:24.200" end="00:24.600">me </span>
        <span begin="00:24.600" end="00:25.200">how </span>
        <span begin="00:25.200" end="00:25.600">to </span>
        <span begin="00:25.600" end="00:26.500">love, </span>
        <span begin="00:26.500" end="00:27.800">maybe </span>
      </p>
      <p begin="00:54.200" end="00:59.800" ttm:agent="v1">
        <span begin="00:54.200" end="00:54.800">I </span>
        <span begin="00:54.800" end="00:55.400">said, </span>
        <span begin="00:55.400" end="00:56.200">ooh, </span>
        <span begin="00:56.200" end="00:56.900">I'm </span>
        <span begin="00:56.900" end="00:57.800">blinded </span>
        <span begin="00:57.800" end="00:58.300">by </span>
        <span begin="00:58.300" end="00:58.800">the </span>
        <span begin="00:58.800" end="00:59.800">lights </span>
      </p>
      <p begin="00:59.800" end="01:05.400" ttm:agent="v1">
        <span begin="00:59.800" end="01:00.600">No, </span>
        <span begin="01:00.600" end="01:01.200">I </span>
        <span begin="01:01.200" end="01:02.000">can't </span>
        <span begin="01:02.000" end="01:02.800">sleep </span>
        <span begin="01:02.800" end="01:03.400">until </span>
        <span begin="01:03.400" end="01:03.900">I </span>
        <span begin="01:03.900" end="01:04.600">feel </span>
        <span begin="01:04.600" end="01:05.000">your </span>
        <span begin="01:05.000" end="01:05.400">touch </span>
      </p>
    </div>
  </body>
</tt>`,
        metadata: stringify({ genre: 'Synthwave / Pop', releaseYear: 2020, hasTtml: true }),
        is_explicit: false,
        views_count: 580000,
      },
    ];

    for (const song of pineSongs) {
      const ttml = song.ttml_lyrics || lrcToTtml(song.synced_lyrics, song.title, song.artist, song.duration);
      await db.execute(
        `INSERT INTO lyrics_pine (title, artist, album, youtube_video_id, duration, plain_lyrics, synced_lyrics, ttml_lyrics, metadata, is_explicit, views_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          song.title,
          song.artist,
          song.album,
          song.youtube_video_id,
          song.duration,
          song.plain_lyrics,
          song.synced_lyrics,
          ttml,
          song.metadata,
          song.is_explicit ? (isSqlite ? 1 : true) : (isSqlite ? 0 : false),
          song.views_count,
        ]
      );
    }
  }

  // 5. Seed YouTube Video ID Cache entries
  const ytCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM youtube_cache');
  if (!ytCount || Number(ytCount.count) === 0) {
    const ytCacheEntries = [
      {
        youtube_video_id: 'CwkzK-Fh400',
        song_id: 1,
        node_id: 'akai',
        title: 'Gurenge (紅蓮華)',
        artist: 'LiSA',
        album: 'Demon Slayer OP',
        duration: 238,
        plain_lyrics: 'Tsuyoku nareru riyuu wo shitta\nBoku wo tsurete susume...',
        synced_lyrics: '[00:00.00]LiSA - Gurenge\n[00:04.12]Tsuyoku nareru riyuu wo shitta\n[00:08.85]Boku wo tsurete susume',
        metadata: stringify({ thumbnail: 'https://i.ytimg.com/vi/CwkzK-Fh400/hqdefault.jpg', channel: 'LiSA Official YouTube', verified: true }),
        hit_count: 1542,
      },
      {
        youtube_video_id: '4NRXx6U8ABQ',
        song_id: 1,
        node_id: 'pine',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        album: 'After Hours',
        duration: 200,
        plain_lyrics: "Yeah\nI've been tryna call\nI've been on my own for long enough...",
        synced_lyrics: "[00:00.00]The Weeknd - Blinding Lights\n[00:14.20]I've been tryna call",
        metadata: stringify({ thumbnail: 'https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg', channel: 'The Weeknd', verified: true }),
        hit_count: 4890,
      },
    ];

    for (const item of ytCacheEntries) {
      const ttml = lrcToTtml(item.synced_lyrics, item.title, item.artist, item.duration);
      await db.execute(
        `INSERT INTO youtube_cache (youtube_video_id, song_id, node_id, title, artist, album, duration, plain_lyrics, synced_lyrics, ttml_lyrics, metadata, hit_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.youtube_video_id,
          item.song_id,
          item.node_id,
          item.title,
          item.artist,
          item.album,
          item.duration,
          item.plain_lyrics,
          item.synced_lyrics,
          ttml,
          item.metadata,
          item.hit_count,
        ]
      );
    }
  }

  // 6. Seed Default Admin User if none exists
  const adminCount = await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM admin_users');
  if (!adminCount || Number(adminCount.count) === 0 || forceAdmin) {
    const defaultPassHash = await bcrypt.hash('admin123456', 10);
    const masterApiKey = 'semar_master_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    
    await db.execute(
      `INSERT INTO admin_users (username, password_hash, role, api_key) VALUES (?, ?, ?, ?)`,
      ['admin', defaultPassHash, 'superadmin', masterApiKey]
    );

    // Also insert master API key record
    const keyHash = await bcrypt.hash(masterApiKey, 10);
    await db.execute(
      `INSERT INTO api_keys (id, key_hash, key_prefix, name, permissions, rate_limit_rpm)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        'key-master-001',
        keyHash,
        masterApiKey.substring(0, 12) + '...',
        'Master System API Key',
        stringify(['admin', 'read', 'write', 'semapi:execute', 'curator:write']),
        1000,
      ]
    );
  }

  // 7. Seed default SemAPI dynamic routes (idempotent per-route so upgrades backfill)
  const defaultSemApiRoutes = [
    {
      id: 'route-fast-anime',
      name: 'Fast Anime Search (Akai)',
      path: '/v1/anime/search',
      method: 'GET',
      description: 'Blazing-fast anime & J-Pop lyrics search scoped to the Akai node partition.',
      tags: ['Anime', 'Search', 'Akai'],
      code: `async function handler(ctx) {
  const q = (ctx.query.q || '').toString();
  const limit = Math.min(parseInt(ctx.query.limit || '10', 10), 50);
  ctx.log('Fast anime search:', q);
  const results = await ctx.nodes.searchLyrics('akai', q, limit);
  return ctx.json({ status: 'success', node: 'akai', query: q, count: results.length, results });
}`,
    },
    {
      id: 'route-global-search',
      name: 'Global Lyrics Search',
      path: '/v1/search',
      method: 'GET',
      description: 'Cross-node lyrics search across all active public partitions.',
      tags: ['Search', 'Global'],
      code: `async function handler(ctx) {
  const q = (ctx.query.q || '').toString();
  const limit = Math.min(parseInt(ctx.query.limit || '20', 10), 100);
  const results = await ctx.lyrics.searchAll(q, limit);
  return ctx.json({ status: 'success', query: q, count: results.length, results });
}`,
    },
    {
      id: 'route-youtube-resolve',
      name: 'YouTube ID Resolver',
      path: '/v1/resolve/youtube/:videoId',
      method: 'GET',
      description: 'Resolve synchronized lyrics directly from a YouTube Video ID via the cache pipeline.',
      tags: ['YouTube', 'Cache'],
      code: `async function handler(ctx) {
  const videoId = (ctx.params.videoId || '').toString();
  if (!videoId) return ctx.error('videoId path parameter is required', 400);
  const lyrics = await ctx.lyrics.getByYouTubeId(videoId);
  if (!lyrics) return ctx.error('No lyrics cached for YouTube ID ' + videoId, 404);
  return ctx.json({ status: 'success', source: 'youtube_lyrics_cache', videoId, lyrics });
}`,
    },
  ];

  for (const route of defaultSemApiRoutes) {
    const existing = await db.queryOne('SELECT id FROM semapi_routes WHERE id = ?', [route.id]);
    if (!existing) {
      await db.execute(
        `INSERT INTO semapi_routes (id, name, path, method, enabled, auth_required, api_key_header, rate_limit_rpm, permissions, request_schema, response_schema, code, default_response, description, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          route.id,
          route.name,
          route.path,
          route.method,
          isSqlite ? 1 : true,
          isSqlite ? 0 : false,
          'X-SemAPI-Key',
          120,
          stringify([]),
          stringify({}),
          stringify({}),
          route.code,
          stringify({ status: 'ok' }),
          route.description,
          stringify(route.tags),
        ]
      );
    }
  }
}
