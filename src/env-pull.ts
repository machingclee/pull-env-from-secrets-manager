import minimist from "minimist"
import fs from "fs";
import SecretUtil, { FileFormat, SecretConfig } from "./SecretUtil";

const downloadConfig = async (config: Partial<SecretConfig> = {}) => {
    const args = minimist(process.argv.slice(2));
    const secret_name = args.secret_name;
    const format = (args.format || "yml") as FileFormat
    const save_at = (args.save_at || "") as string;

    console.log(`Pulling secret ${secret_name} in ${format} format ...`)

    const secretUtil = new SecretUtil(config);

    const jsons = await secretUtil.getSecretAsJson(secret_name);
    const formatedSecret = secretUtil.toTargetFomat(jsons, format)

    if (save_at) {
        fs.writeFileSync(save_at, formatedSecret);
        console.log(`config pulled at ${save_at}`)
    }
}

export { downloadConfig }



