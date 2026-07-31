export interface RuntimeManifestAsset {
  name: string;
  browser_download_url: string;
  size: number;
  sha256: string;
}

export interface LlamaRuntimeManifestEntry {
  variant: string;
  asset: RuntimeManifestAsset;
  dependencyAssets?: RuntimeManifestAsset[];
}

export const LLAMA_CPP_RUNTIME_MANIFEST = {
  releaseTag: "b10188",
  entries: [
    {
      variant: "android-arm64-cpu",
      asset: {
        name: "llama-b10188-bin-android-arm64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-android-arm64.tar.gz",
        size: 76_539_346,
        sha256: "bab11bebc8cd9b4d28e64ac1e0341e5ea6a7cd70feedbf22b8b48ea77fae727b",
      },
    },
    {
      variant: "macos-arm64-metal",
      asset: {
        name: "llama-b10188-bin-macos-arm64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-macos-arm64.tar.gz",
        size: 10_942_356,
        sha256: "5cc92938f12fb8224db24126a1dab0d18a1c85f88a3822620847ca89fd7f967d",
      },
    },
    {
      variant: "macos-x64-cpu",
      asset: {
        name: "llama-b10188-bin-macos-x64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-macos-x64.tar.gz",
        size: 11_218_582,
        sha256: "f5c002826c17c53d76f34697032f52d360670097c925329a1a4461fda1099031",
      },
    },
    {
      variant: "win-x64-cuda",
      asset: {
        name: "llama-b10188-bin-win-cuda-13.3-x64.zip",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-win-cuda-13.3-x64.zip",
        size: 144_376_762,
        sha256: "aed95c377742402cdbe79d690363a9fcf07ec7dad741a094f8542e1513d23c0a",
      },
      dependencyAssets: [
        {
          name: "cudart-llama-bin-win-cuda-13.3-x64.zip",
          browser_download_url:
            "https://github.com/ggml-org/llama.cpp/releases/download/b10188/cudart-llama-bin-win-cuda-13.3-x64.zip",
          size: 390_970_417,
          sha256: "1462a050eb4c684921ba51dcc4cc488a036674c3e73e9945ee705b854808d03e",
        },
      ],
    },
    {
      variant: "win-x64-hip",
      asset: {
        name: "llama-b10188-bin-win-hip-radeon-x64.zip",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-win-hip-radeon-x64.zip",
        size: 323_001_696,
        sha256: "ae6ddc692f13c810dfc5e791b3898a125b9eb208b7f2523e02c02d3794759e19",
      },
    },
    {
      variant: "win-x64-sycl",
      asset: {
        name: "llama-b10188-bin-win-sycl-x64.zip",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-win-sycl-x64.zip",
        size: 119_901_959,
        sha256: "8ccd0b65a04db7360fd7b1b7fa04fe63421e0d7c6e8f0fe79128e7dbe5a3c94c",
      },
    },
    {
      variant: "win-x64-vulkan",
      asset: {
        name: "llama-b10188-bin-win-vulkan-x64.zip",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-win-vulkan-x64.zip",
        size: 33_640_898,
        sha256: "750d4c489dca8cc8de4bd781f764bdd92b38d1160edc4dfff6db783c2e15c4fd",
      },
    },
    {
      variant: "win-x64-cpu",
      asset: {
        name: "llama-b10188-bin-win-cpu-x64.zip",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-win-cpu-x64.zip",
        size: 18_351_909,
        sha256: "79305529bd25566e08c169c154d95f78a35cecb67add08828eb2167268583f40",
      },
    },
    {
      variant: "win-arm64-cpu",
      asset: {
        name: "llama-b10188-bin-win-cpu-arm64.zip",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-win-cpu-arm64.zip",
        size: 12_195_877,
        sha256: "53802ceea3ec65ca959ea940f4c8695bf5e088d847b1f469b4300b3e60e74fd4",
      },
    },
    {
      variant: "linux-x64-rocm",
      asset: {
        name: "llama-b10188-bin-ubuntu-rocm-7.2-x64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-ubuntu-rocm-7.2-x64.tar.gz",
        size: 128_371_202,
        sha256: "eeff0c5b64e5a0a5f091656a4b9b516f44e2ea3f93e5dd4fa136b093a479cd10",
      },
    },
    {
      variant: "linux-x64-vulkan",
      asset: {
        name: "llama-b10188-bin-ubuntu-vulkan-x64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-ubuntu-vulkan-x64.tar.gz",
        size: 32_412_142,
        sha256: "1356913916947aacfd10771131b105cbbab3c50060c80cf464798358a4a7a4da",
      },
    },
    {
      variant: "linux-x64-cpu",
      asset: {
        name: "llama-b10188-bin-ubuntu-x64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-ubuntu-x64.tar.gz",
        size: 16_432_107,
        sha256: "63126a02b981372c9d185b7bcf8a9fa786581bbc3ba7f3abeaf82b25148cba1b",
      },
    },
    {
      variant: "linux-arm64-vulkan",
      asset: {
        name: "llama-b10188-bin-ubuntu-vulkan-arm64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-ubuntu-vulkan-arm64.tar.gz",
        size: 26_495_018,
        sha256: "10ca3cc550102d4c80aeebf88feeeff7691b748f811e59ec8a2c714a2ffdc998",
      },
    },
    {
      variant: "linux-arm64-cpu",
      asset: {
        name: "llama-b10188-bin-ubuntu-arm64.tar.gz",
        browser_download_url:
          "https://github.com/ggml-org/llama.cpp/releases/download/b10188/llama-b10188-bin-ubuntu-arm64.tar.gz",
        size: 13_336_265,
        sha256: "54e3bdf1b12328c83f0de382b3eb5d71030e8c72181bd2ae3df6ca252a87ead0",
      },
    },
  ] satisfies LlamaRuntimeManifestEntry[],
} as const;

export const MLX_RUNTIME_MANIFEST = {
  mlxLm: {
    revision: "e5baded8c1d286754edb479ffbde4655a68e2758",
    packageSpec:
      "mlx-lm @ https://github.com/ml-explore/mlx-lm/archive/e5baded8c1d286754edb479ffbde4655a68e2758.zip",
    requirementsLockSha256: "e77db61b3f9fac368bd654b1625789c7ee59acee5ea1508fb3b61f52014caecc",
    archive: {
      name: "mlx-lm-e5baded8c1d286754edb479ffbde4655a68e2758.zip",
      browser_download_url:
        "https://github.com/ml-explore/mlx-lm/archive/e5baded8c1d286754edb479ffbde4655a68e2758.zip",
      size: 516_242,
      sha256: "0ceac44ed08546e5ce7cb786ac438b3377936d9ddaf06c7555070fd9c7ea630e",
    },
  },
  uv: {
    version: "0.12.0",
    archive: {
      name: "uv-aarch64-apple-darwin.tar.gz",
      browser_download_url:
        "https://github.com/astral-sh/uv/releases/download/0.12.0/uv-aarch64-apple-darwin.tar.gz",
      size: 17_387_877,
      sha256: "2b9e582af54f84fa50c115427451a6c13e80f43b52f8282b8af5791077317bbf",
    },
  },
} as const;

export function getLlamaRuntimeManifestEntry(variant: string): LlamaRuntimeManifestEntry | null {
  return (
    LLAMA_CPP_RUNTIME_MANIFEST.entries.find((entry) => entry.variant === variant) ??
    null
  );
}

export function serializeMlxRuntimeManifestStamp(): string {
  return JSON.stringify({
    mlxLm: {
      revision: MLX_RUNTIME_MANIFEST.mlxLm.revision,
      packageSpec: MLX_RUNTIME_MANIFEST.mlxLm.packageSpec,
      sha256: MLX_RUNTIME_MANIFEST.mlxLm.archive.sha256,
      requirementsLockSha256: MLX_RUNTIME_MANIFEST.mlxLm.requirementsLockSha256,
    },
    uv: {
      version: MLX_RUNTIME_MANIFEST.uv.version,
      sha256: MLX_RUNTIME_MANIFEST.uv.archive.sha256,
    },
  });
}
