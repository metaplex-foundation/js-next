import babel from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';

const env = process.env.NODE_ENV;
const extensions = ['.js', '.ts'];
const builds = [
  {
    dir: 'dist/esm',
    format: 'es',
  },
  {
    dir: 'dist/cjs',
    format: 'cjs',
  },
  {
    dir: 'dist/esm-browser',
    format: 'es',
    browser: true,
  },
  {
    dir: 'dist/cjs-browser',
    format: 'cjs',
    browser: true,
  },
  {
    file: 'dist/iife/index.js',
    format: 'iife',
    browser: true,
    bundle: true,
  },
  {
    file: 'dist/iife/index.min.js',
    format: 'iife',
    browser: true,
    bundle: true,
    minified: true,
  },
];

const globals = {
  '@aws-sdk/client-s3': 'AwsS3Client',
  '@bundlr-network/client': 'BundlrNetworkClient',
  '@metaplex-foundation/beet': 'MetaplexBeet',
  '@metaplex-foundation/beet-solana': 'MetaplexBeetSolana',
  '@metaplex-foundation/mpl-candy-machine': 'MetaplexMplCandyMachine',
  '@metaplex-foundation/mpl-token-metadata': 'MetaplexMplTokenMetadata',
  '@solana/spl-token': 'SolanaSplToken',
  '@solana/wallet-adapter-base': 'SolanaWalletAdapterBase',
  '@solana/web3.js': 'SolanaWeb3',
  'abort-controller': 'AbortController',
  'bignumber.js': 'BigNumber',
  'bn.js': 'BN',
  bs58: 'Bs58',
  buffer: 'Buffer',
  'cross-fetch': 'CrossFetch',
  debug: 'Debug',
  eventemitter3: 'EventEmitter3',
  'lodash.clonedeep': 'LodashClonedeep',
  mime: 'Mime',
  tweetnacl: 'Tweetnacl',
};

const dependenciesToBundle = [
  '@metaplex-foundation/beet',
  '@metaplex-foundation/beet-solana',
  '@metaplex-foundation/mpl-candy-machine',
  '@metaplex-foundation/mpl-token-metadata',
  'buffer',
];

const createConfig = (build) => {
  const { file, dir, format, browser = false, bundle = false, minified = false } = build;

  const external = Object.keys(globals).filter((dependency) => {
    return !bundle || !dependenciesToBundle.includes(dependency);
  });

  return {
    input: ['src/index.ts'],
    output: {
      dir,
      file,
      format,
      exports: 'named',
      preserveModules: !browser,
      sourcemap: true,
      globals,
    },
    external,
    treeshake: {
      moduleSideEffects: false,
    },
    plugins: [
      commonjs(),
      nodeResolve({
        browser,
        dedupe: ['bn.js', 'buffer'],
        extensions,
        preferBuiltins: !browser,
      }),
      babel({
        exclude: '**/node_modules/**',
        extensions,
        babelHelpers: bundle ? 'bundled' : 'runtime',
        plugins: bundle ? [] : ['@babel/plugin-transform-runtime'],
      }),
    ],
  };
};

export default builds.map((build) => createConfig(build));
