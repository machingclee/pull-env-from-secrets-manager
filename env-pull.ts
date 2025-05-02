import minimist from "minimist"
import fs from "fs";
import SecretUtil, { FileFormat } from "./SecretUtil";

const downloadConfig = async () => {
    const args = minimist(process.argv.slice(2));
    const secret_name = args.secret_name;
    const format = (args.format || "yml") as FileFormat
    const save_at = (args.save_at || "") as string;

    const envUtil = new SecretUtil();

    const nestedJsonSecret = await envUtil.getSecretAsJson(secret_name);
    const formatedSecret = envUtil.toTargetFomat(nestedJsonSecret, format)

    if (save_at) {
        fs.writeFileSync(save_at, formatedSecret);
    }
}

export { downloadConfig }



