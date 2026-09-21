# FLAC metadata

Quicksilver leaves Mediabunny's default conversion metadata behavior in place: when no `tags` option is provided, descriptive tags are copied from the input. FLAC writes those tags as Vorbis comments and embedded cover art as FLAC picture blocks.

| Input tag | FLAC Vorbis comment |
| --- | --- |
| title, album, artist | `TITLE`, `ALBUM`, `ARTIST` |
| date, genre, comment | `DATE` (YYYY-MM-DD), `GENRE`, `COMMENT` |
| track/disc number and totals | `TRACKNUMBER`, `TRACKTOTAL`, `DISCNUMBER`, `DISCTOTAL` |
| raw string values | Their original keys, except `vendor` and keys already represented by a normalized tag |
| cover art | A FLAC `PICTURE` metadata block (front cover maps to picture type 3) |

Raw non-string values, the source Vorbis vendor string, and duplicate raw keys that collide with a normalized tag are not copied. FLAC does not retain an input ID3 container: any supported source metadata is normalized into FLAC's Vorbis-comment/picture representation.
