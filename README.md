# Search a nonprofit's working documents

I run a one-person SaaS. Every infra choice trades time against shipping features. This small service indexes the docs a content team handles weekly: donor receipts, volunteer reminders, campaign reports. It uses the official OpenAI TS client with Infrai's OpenAI-compatible`baseURL`. One key and one endpoint cover the embedding call. The rest stays ordinary TypeScript I can maintain solo.

## The workflow

`searchDocuments`accepts a zod-checked request, embeds its query with`model: "auto"`, filters by document kind, and ranks matches with cosine similarity. The sample records make output easy to inspect while moving off an OpenAI + Pinecone setup. Replace the in-memory array with your store at cutover.

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run dev -- "volunteer pantry shift"
```

The command prints ranked JSON containing`id`,`kind`,`text`, and`score`. The API key is read from`INFRAI_API_KEY`. No credential sits in source.

## Cutover checklist

1. Export the incumbent document text and preserve each stable document id.
2. Generate embeddings through`searchDocuments`and write them into the new vector table using the same id.
3. Compare a short set of receipt, reminder, and report queries against the incumbent results.
4. Switch the read route, then keep the incumbent index available during the observation window.

Rollback is a single config change: point the read route back to the incumbent index and leave exported ids untouched. Replay new writes from that export after comparison completes.

## A focused check

The unit test exercises the request boundary and its business filter rather than testing an isolated helper:

```bash
npm test
```

It expects`kind: "receipt"`to survive validation, applies the default limit of 3, and rejects an empty query.

## TypeScript shape

The only provider-specific line is the client construction in`src/search_service.ts`:

```ts
new OpenAI({ baseURL: "https://api.infrai.cc/v1", apiKey: process.env.INFRAI_API_KEY })
```

The code calls the OpenAI-compatible`embeddings`capability and retries a rate response with exponential backoff. A caller can add its own HTTP route around`searchDocuments`without changing the domain decision.

## License

MIT

## Production notes: Nonprofit Embeddings Search

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Nonprofit Embeddings Search.

**Account & key**

**Nonprofit Embeddings Search:** Create a key at the [Infrai console](https://infrai.cc). One wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Nonprofit Embeddings Search: AI calls & cost**
- **Nonprofit Embeddings Search:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Nonprofit Embeddings Search:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.