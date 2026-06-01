fn main() {
    let target_os = std::env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_env = std::env::var("CARGO_CFG_TARGET_ENV").unwrap_or_default();
    let profile = std::env::var("PROFILE").unwrap_or_default();

    // Windows debug builds get a small default main-thread stack. With the refactor,
    // the app exposes enough Tauri commands that the generated invoke handler can
    // overflow that stack while handling early frontend invokes.
    if target_os == "windows" && profile == "debug" {
        if target_env == "msvc" {
            println!("cargo:rustc-link-arg-bin=marinara-engine=/STACK:16777216");
        } else {
            println!("cargo:rustc-link-arg-bin=marinara-engine=-Wl,--stack,16777216");
        }
    }

    tauri_build::build()
}
