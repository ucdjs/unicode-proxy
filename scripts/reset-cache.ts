import process from "node:process";

async function run() {
  console.log("resetting cache...");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
