# secrets-manager-to-config

Assume that in AWS secret manages we have defined a secret `abc` with `a.b.c = "123"`, then create a file `pull-env` and write

```ts
// pull-env.ts
import { downloadConfig } from "secrets-manager-to-config";

downloadConfig();
```

now you can pull your secret into nested `json` or `yml` by

```js
// yml can be replaced by json
// tsm can be replaced by ts-node, whatever way you can execute a ts file
npx tsm pull-env.ts --secret_name abc --format yml --save_at test.yml
```

which results in

```yml
# test.yml

a:
  b:
    c: "123"
```
