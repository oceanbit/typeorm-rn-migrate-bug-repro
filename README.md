This repo is attempting to show a problem when attempting to utilize TypeORM CLI's `migrate:generate` functionality when using `react-native` driver.

## Initial Detection of Bug

If we follow TypeORM's guide [to adding `ts-node` to your project](https://typeorm.io/#/using-cli/if-entities-files-are-in-typescript), then run `yarn ts-migrate` to execute `typeorm migration:generate -n InitialProd`, it will give an error that doesn't seem quite right:

```
Error during migration generation:
DriverPackageNotInstalledError: React-Native package has not been found installed. Try to install it: npm install react-native-sqlite-storage --sav
```

While this error _can_ be a problem, even once you've installed the package properly, we still get this error.

Because of the way error handling is built in `ReactNativeDriver` currently, we're getting a false-positive here. If we modify the source code to add a simple `console.error` statement, we get this error:

```
$ node --require ts-node/register ./node_modules/typeorm/cli.js migration:generate -n InitialProd
C:\Users\crutchcorn\git\OceanBit\RN\External\typeorm-rn-migrate-bug-repro\node_modules\react-native\index.js:14
import typeof AccessibilityInfo from './Libraries/Components/AccessibilityInfo/AccessibilityInfo';
       ^^^^^^

SyntaxError: Unexpected token typeof
    at Module._compile (internal/modules/cjs/loader.js:703:23)
    at Module._extensions..js (internal/modules/cjs/loader.js:770:10)
```

> If you're not wanting to deal with `yarn link` and the complexity of debugging that adds, you can edit the compiled source code of `typeorm` to see the correct error. Simply edit:
>
> [./node_modules/typeorm/driver/react-native/ReactNativeDriver.js](./node_modules/typeorm/driver/react-native/ReactNativeDriver.js)
>
> On Line 83, there's a try/catch. In the `catch`, add a `console.error` statement.

This error now properly contextualized, it seems that what's actually going wrong is that `react-native`'s `index.js` file is written in Flow. Because `ts-node` doesn't know how to handle flow, it simply throws a syntax error when it reaches invalid JavaScript syntax.

## Naive Attempted Solution

While `ts-node` is unable to detect flow properly, `babel` is. With the package `@babel/node`/`babel-node`, we're able to run babel over `typeorm`'s CLI. Then, utilizing the official RN babel plugin (currently `metro-react-native-babel-preset`), it should be able to compile React Native for us.

While we ultimately needed more configuration to make this concept work in practice, when we finally completed it we added the new commands to the `package.json`:

```
"babel-typeorm": "babel-node -x .ts --config-file ./babel.config.js ./babel-register.js",
"babel-migrate": "yarn babel-typeorm migration:generate -n InitialProd"
```

Sure enough, once these changes are made, `yarn babel-migrate` no longer throws the error we were getting.

However, we get a new error (once we make the changes to the `typeorm` source code to fix the incorrect error message issue):

```
$ babel-node -x .ts --config-file ./babel.config.js ./babel-register.js migration:generate -n InitialProd
Invariant Violation: __fbBatchedBridgeConfig is not set, cannot invoke native modules
    at invariant (C:\Users\crutchcorn\git\OceanBit\RN\External\typeorm-rn-migrate-bug-repro\node_modules\invariant\/invariant.js:40:15)
    at Object.<anonymous> (C:\Users\crutchcorn\git\OceanBit\RN\External\typeorm-rn-migrate-bug-repro\node_modules\react-native\Libraries\BatchedBridge\/NativeModules.js:177:3)
```

It was then that I realized the true scope of the problem.

## Deeper Explaination

While other drivers have the ability to run on the development machine natively, the `react-native` driver is unable to do this currently. This is because in order to do so, we'd need to spin up an instance of `react-native` running on their native platforms. While this _might_ be theoretically possible for `react-native-windows` and `react-native-macos`, that would leave platforms like Linux in the dust. `react-native-macos` is also not well documented currently, and the performance of spinning up an app instance simply for a migration feels like a waste of resources.

Further, even if we did get that infrastructure in place, we're then limited by the platforms supported by `react-native-sqlite-storage`. While it seems there is [windows support in the library](https://github.com/andpor/react-native-sqlite-storage/tree/master/platforms/windows), there doesn't appear to be the same for macOS yet.

However, we already have `sqlite` as a driver supported in TypeORM... Maybe we could add conditional logic to `typeorm`'s CLI to detect if the platform is `react-native` and run the migration on that platform? I'm admittedly unsure if there are complications in doing so that I simply am not aware of currently.

<details>
<summary>P.S.</summary>

"If I had more time, I would have written a shorter letter"
- Unknown

This was long-winded... I guess that's what happens when you start coding at 2AM, spend hours and hours modifying CJS source code, tinkering with babel plugins, and then realize that the problem has more nuance than you originally thought.

I'm going to sleep now lol

</details>