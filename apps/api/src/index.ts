import { env } from "./config/env.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  process.stdout.write(`API listening on port ${env.PORT}\n`);
});
