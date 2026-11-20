# Third-party notices

This file records licenses that the Unlicense in `LICENSE` does not replace. It is an engineering record, not a legal opinion.

## SmartFlowSocial-authored code

Code written for this service is under the Unlicense. See `LICENSE`. That dedication does not apply to the materials below, and it does not relicense Git commits that predate a removal.

## Mutiny Wallet Blastr

Repository: https://github.com/MutinyWallet/blastr

The broadcast-relay idea used by this service comes from that project. This repository is not affiliated with, endorsed by, or maintained by Mutiny Wallet.

Commit `8fcb1ec` of this repository added four files that were byte-identical to that project:

- `docs/images/blastr-diagram.png`
- `static/favicon.ico`
- `migrations/0000_events.sql`
- `migrations/0001_tag.sql`

Those files are not in the current tree. They remain in Git history because history was not rewritten. A clone of this repository still downloads those historical blobs. The MIT license that covered them is reproduced here so the required notice stays with this repository.

`migrations/0003_seed_system_relays.sql` still inserts eight public relay URLs in the same order as that project's fallback list. The executable SQL was not changed. See `docs/SOURCE_PROVENANCE.md`.

```
MIT License

Copyright (c) 2023 Mutiny Wallet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Direct dependencies

| Package     | Version in this repo | Role                                                 | License                                   |
| ----------- | -------------------- | ---------------------------------------------------- | ----------------------------------------- |
| nostr-tools | 2.26.1               | Nostr event verification                             | Unlicense (that project's own dedication) |
| hono        | 4.13.19              | Declared in package.json. `src/` does not import it. | MIT                                       |

Hono's MIT license is the license in that package. Transitive dependency licenses are not reproduced here. They remain in the packages installed from `pnpm-lock.yaml`.
