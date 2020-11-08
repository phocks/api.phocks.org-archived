import { Application, Router } from "https://deno.land/x/oak@v6.3.1/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.1/mod.ts";
import { green, yellow } from "https://deno.land/std@0.53.0/fmt/colors.ts";
import { MongoClient } from "https://deno.land/x/mongo@v0.13.0/mod.ts";

const client = new MongoClient();
client.connectWithUri("mongodb://localhost:27017");

// Defining schema interface
interface CountSchema {
  _id: { $oid: string };
  referer: string;
  count: number;
}

const db = client.database("phocks");
const counts = db.collection<CountSchema>("counts");

const allCounts = await counts.find({ referer: { $ne: null } });
console.log(allCounts);

const app = new Application();
const port: number = 65000;

app.use(
  oakCors({
    origin: "*",
  })
);

// Logger
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  console.log(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// Timing
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

const router = new Router();

router.get("/", async ({ response }: { response: any }) => {
  response.body = {
    message: "Hello. Welcome to the API.",
  };
});

// Returns how many times a referrer has requested
router.get("/count", async (context) => {
  const headers = context.request.headers;
  const referer = headers.get("referer");

  if (referer) {
    const found = await counts.findOne({ referer: referer });

    if (found) {
      const {
        matchedCount,
        modifiedCount,
        upsertedId,
      } = await counts.updateOne(
        { referer: referer },
        { $set: { count: found.count + 1 } }
      );

      context.response.body = {
        referer: referer,
        count: found.count + 1,
      };
    } else {
      const result = await counts.insertOne({
        referer: referer,
        count: 1,
      });

      context.response.body = {
        referer: referer,
        count: 1,
      };
    }
  } else {
    context.response.body = {
      referer: null,
      count: 0,
    };
  }
});

app.use(router.routes());
app.use(router.allowedMethods());

app.addEventListener("listen", ({ secure, hostname, port }) => {
  const protocol = secure ? "https://" : "http://";
  const url = `${protocol}${hostname ?? "localhost"}:${port}`;
  console.log(`${yellow("Listening on:")} ${green(url)}`);
});

await app.listen({ port });
