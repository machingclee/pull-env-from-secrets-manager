import minimist from "minimist";
import fs from "fs";
import SecretUtil, { FileFormat, SecretConfig } from "./SecretUtil";
import path from "path";
import ts from "typescript";

const parseTypescriptToJson = async <T = any>(ts_path: string) => {
  const secretUtil = new SecretUtil();
  const json = (await secretUtil.parseTypeScriptFileToJSON(ts_path)) as T;
  return json;
};

const uploadConfig = async (config: Partial<SecretConfig> = {}) => {
  const secretUtil = new SecretUtil(config);
  const args = minimist(process.argv.slice(2));
  const secret_name = args.secret_name;
  const ts_path = args.ts_path;
  const json = await secretUtil.parseTypeScriptFileToJSON(ts_path);
  if (!json) {
    throw Error("Upload failed");
  }
  const flattened = secretUtil.flattenJson(json);
  await secretUtil.uploadSecret(secret_name, JSON.stringify(flattened));
  console.log(`Uploaded the following to secret ${secret_name}`);
};

const downloadConfig = async (config: Partial<SecretConfig> = {}) => {
  const args = minimist(process.argv.slice(2));
  const secret_name = args.secret_name;
  const format = (args.format || "yml") as FileFormat;
  const save_at = (args.save_at || "") as string;

  console.log(`Pulling secret ${secret_name} in ${format} format ...`);

  const secretUtil = new SecretUtil(config);

  const jsons = await secretUtil.getSecretAsJson(secret_name);
  const formatedSecret = secretUtil.toTargetFomat(jsons, format);

  if (save_at) {
    fs.writeFileSync(save_at, formatedSecret);
    console.log(`config pulled at ${save_at}`);
  }
};

export { downloadConfig, uploadConfig, parseTypescriptToJson };
