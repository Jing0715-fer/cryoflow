// eslint-disable-next-line @typescript-eslint/no-require-imports -- CommonJS file: require() IS this dialect's import; the rule targets ES modules
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const params = process.argv[2];
p.job.update({ where: { id: "cmttefupd0001p8wsq8mu0tdp" }, data: { params } })
  .then(() => { console.log("updated"); return p.$disconnect(); })
  .catch(e => { console.error(e.message); process.exit(1); });
