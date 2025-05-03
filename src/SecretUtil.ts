import { GetSecretValueCommand, GetSecretValueCommandOutput, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import lodash from "lodash";
import * as yaml from 'js-yaml';

export type FileFormat = "yml" | "json" | "flat_env"
export type SecretConfig = { awsRegion: string }

export default class SecretUtil {
    private secretConfig: SecretConfig = { awsRegion: "ap-southeast-2" }

    constructor(config: Partial<SecretConfig> = {}) {
        this.secretConfig = { ...this.secretConfig, ...config };
    }

    toTargetFomat(json: { nestedJson: any, flatJson: any }, format: FileFormat) {
        const { flatJson, nestedJson } = json;
        if (format === "yml") {
            return this.jsonToYml(nestedJson);
        }
        else if (format === "json") {
            return JSON.stringify(nestedJson, null, 2);
        }
        else if (format === "flat_env") {
            return Object.entries(flatJson).map(([flatKey, value]) => {
                return `${flatKey}=${value}`
            }).join("\n")
        }
        return "{}";
    }

    jsonToYml(nestedJson: any) {
        const ymlString = yaml.dump(nestedJson, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            noCompatMode: true,
            schema: yaml.JSON_SCHEMA
        });
        return ymlString
    }

    async getSecretAsJson(secret_name: string) {
        const client = new SecretsManagerClient({
            region: this.secretConfig.awsRegion,
        });
        let response: GetSecretValueCommandOutput | null = null;

        try {
            response = await client.send(
                new GetSecretValueCommand({ SecretId: secret_name })
            );
        } catch (error) {
            throw error;
        }

        const secret = response.SecretString || "{}";
        const json = JSON.parse(secret);
        const nestedJson: { [key: string]: any } = {}
        const flatJson: { [key: string]: any } = {}
        Object.entries(json).sort(([k1, _], [k2, __]) => {
            return k1.localeCompare(k2)
        }).forEach(([k, v]) => {
            lodash.set(nestedJson, k, v);
            flatJson[k] = v
        })

        return { nestedJson, flatJson }
    }
}

