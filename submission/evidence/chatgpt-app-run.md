# ChatGPT desktop app run, 2026-09-01

The judged client, exercised for real. Harness: **ChatGPT desktop app for macOS,
built-in browser tab** (View > Browser > Open Browser Tab), model **GPT-5.6 Sol,
Extra High**, Browser settings > "Enable site tools" ON (the toggle names WebMCP
in its own description: "Allow ChatGPT to discover and call site tools exposed
by websites, including WebMCP").

Prompt, verbatim:

> Open https://segregation-console.vercel.app in your built-in browser and use
> the site's own tools (WebMCP site tools). First list every site tool you can
> see by name. Then: load UN1830 and UN1748 on one truck, check whether that
> load is legal, and export the shipping paper. Report the exact verdict and any
> regulation it quotes.

Mid-run, the agent reported the registry changing under it, unprompted:

> The site currently exposes two WebMCP tools: `lookup_material`,
> `classify_line_item`. [...] After UN1830 entered the manifest, the site
> dynamically added two more tools: `propose_load`, `check_segregation`. The
> registry is state-dependent, so I'm tracking each change before calling
> anything.

Final response, copied verbatim from the app:

> Site tools seen:
>
> - `lookup_material`
> - `classify_line_item`
> - `propose_load`
> - `check_segregation`
> - `commit_manifest`, listed by the registry but unavailable for this failed load
>
> I checked one vehicle containing `UN1830` and `UN1748`.
>
> **Exact verdict:** `REFUSED`
> **Ground:** `CORROSIVE_OVER_OXIDIZER`
>
> Quoted regulation, `49 CFR 177.848(e)(3)`:
>
> > Notwithstanding the methods of separation employed, Class 8 (corrosive)
> > liquids may not be loaded above or adjacent to Class 4 (flammable) or
> > Class 5 (oxidizing) materials; except that shippers may load truckload
> > shipments of such materials together when it is known that the mixture of
> > contents would not cause a fire or a dangerous evolution of heat or gas.
>
> No shipping paper was exported. The site withheld `commit_manifest` because
> the load failed, so export was blocked. The page had no single-shipper or
> non-reaction attestations selected.

Screenshots, cropped to the transcript column: `chatgpt-app-dynamic-registration.png`
(the registry growing as state changed) and `chatgpt-app-refused-verdict.png`
(the verdict with the model badge visible). The quoted clause matches the
committed corpus byte for byte; the citation gate proves that on every CI run.

One wording note. The agent said `commit_manifest` was "listed by the registry
but unavailable": the page's tool-registry strip deliberately RENDERS the gated
tool as an inert entry so a human can see what is being withheld, while the
actual WebMCP registry does not register it until the load passes. The agent
could not call it, which is the property that matters.
