import {
  CreateSecretCommand,
  DescribeSecretCommand,
  GetSecretValueCommand,
  GetSecretValueCommandOutput,
  SecretsManagerClient,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import lodash from "lodash";
import * as yaml from "js-yaml";
import fs from "fs";
import path from "path";
import ts from "typescript";

export type FileFormat = "yml" | "json" | "flat_env";
export type SecretConfig = { awsRegion: string };

export default class SecretUtil {
  private secretConfig: SecretConfig = { awsRegion: "ap-southeast-2" };
  private client: SecretsManagerClient | null = null;

  constructor(config: Partial<SecretConfig> = {}) {
    this.secretConfig = { ...this.secretConfig, ...config };
  }

  private getSecretsManagerClient() {
    if (!this.client) {
      this.client = new SecretsManagerClient({
        region: this.secretConfig.awsRegion,
      });
    }
    return this.client;
  }

  async uploadSecret(secretName: string, secretString: string) {
    const client = this.getSecretsManagerClient();
    try {
      await client.send(new DescribeSecretCommand({ SecretId: secretName }));

      // Secret exists, update it
      const result = await client.send(
        new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: secretString,
        })
      );

      console.log(`Secret ${secretName} successfully updated!`);
      return result;
    } catch (error: any) {
      if (error.name === "ResourceNotFoundException") {
        // Secret doesn't exist, create it
        const result = await client.send(
          new CreateSecretCommand({
            Name: secretName,
            Description: `Configuration for ${secretName}`,
            SecretString: secretString,
          })
        );

        console.log(`Secret ${secretName} successfully created!`);
        return result;
      } else {
        // Unexpected error
        throw error;
      }
    }
  }

  async parseTypeScriptFileToJSON(filePath: string) {
    try {
      const projectRoot = findProjectRoot();
      const absolutePath = path.join(projectRoot, filePath);
      console.log(`Loading default export from ${absolutePath} ...`);
      // Check if file exists
      if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }
      // Register ts-node to handle TypeScript files
      require("ts-node").register({
        transpileOnly: true, // Skip type checking
        compilerOptions: {
          module: "CommonJS",
          moduleResolution: "node",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          target: "ES2020",
        },
      });

      // Use require to load the TypeScript file
      const module = require(absolutePath);
      const exportedValue = module.default || module;

      // If the exported value is an object, return it
      if (typeof exportedValue === "object" && exportedValue !== null) {
        return exportedValue;
      }

      throw new Error("No valid object export found in the file");
    } catch (error) {
      console.error("Error parsing TypeScript file:", error);
      return null;
    }
  }

  toTargetFomat(json: { nestedJson: any; flatJson: any }, format: FileFormat) {
    const { flatJson, nestedJson } = json;
    if (format === "yml") {
      return this.jsonToYml(nestedJson);
    } else if (format === "json") {
      return JSON.stringify(nestedJson, null, 2);
    } else if (format === "flat_env") {
      return Object.entries(flatJson)
        .map(([flatKey, value]) => {
          return `${flatKey}=${value}`;
        })
        .join("\n");
    }
    return "{}";
  }

  jsonToYml(nestedJson: any) {
    const ymlString = yaml.dump(nestedJson, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      noCompatMode: true,
      schema: yaml.JSON_SCHEMA,
    });
    return ymlString;
  }

  flattenJson(obj: { [key: string]: any }, prefix = "") {
    return lodash.reduce(
      obj,
      (result: any, value, key) => {
        const newKey = prefix ? `${prefix}.${key}` : key;

        if (lodash.isPlainObject(value)) {
          // If it's a plain object, recurse and flatten
          Object.assign(result, this.flattenJson(value, newKey));
        } else if (lodash.isArray(value)) {
          // If it's an array, join values with comma
          result[newKey] = value.join(",");
        } else {
          // Otherwise use the plain value
          result[newKey] = value;
        }

        return result;
      },
      {}
    );
  }

  async getSecretAsJson(secret_name: string) {
    const client = this.getSecretsManagerClient();
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
    const nestedJson: { [key: string]: any } = {};
    const flatJson: { [key: string]: any } = {};
    Object.entries(json)
      .sort(([k1, _], [k2, __]) => {
        return k1.localeCompare(k2);
      })
      .forEach(([k, v]) => {
        lodash.set(nestedJson, k, v);
        flatJson[k] = v;
      });

    return { nestedJson, flatJson };
  }
}
function findProjectRoot() {
  let projectRoot = __dirname;
  while (projectRoot !== path.dirname(projectRoot)) {
    if (fs.existsSync(path.join(projectRoot, "package.json"))) {
      const hasNodeModules = fs.existsSync(
        path.join(projectRoot, "node_modules")
      );
      const hasGit = fs.existsSync(path.join(projectRoot, ".git"));
      const hasSrc = fs.existsSync(path.join(projectRoot, "src"));
      const hasReadme = fs.existsSync(path.join(projectRoot, "README.md"));

      // If this has multiple indicators of being a main project, use it
      if (hasNodeModules || hasGit || hasSrc || hasReadme) {
        break;
      }
    }
    projectRoot = path.dirname(projectRoot);
  }
  // at this point I get the project root in node_modules, now go two directories up to get the root of the project
  projectRoot = path.dirname(path.dirname(projectRoot));
  return projectRoot;
}
