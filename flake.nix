{
  description = "Terminal TUI for comparing two directories side by side";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
    in
    {
      packages = forAllSystems (
        system:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          packageJson = builtins.fromJSON (builtins.readFile ./package.json);

          node_modules = pkgs.stdenv.mkDerivation {
            pname = "dircmp-node-modules";
            version = packageJson.version;
            src = ./.;
            nativeBuildInputs = [ pkgs.bun ];
            dontFixup = true;
            impureEnvVars = pkgs.lib.fetchers.proxyImpureEnvVars;
            outputHashMode = "recursive";
            outputHash = "sha256-HifjjJeX4AMU6zB55D1j4yVrlk/76j9XTiEPX2TWB/c=";
            buildPhase = ''
              export HOME=$TMPDIR

              # Nix never retries a failed fixed-output derivation, so one flaky
              # registry fetch would sink every build depending on this package.
              for attempt in 1 2 3; do
                if bun install --frozen-lockfile --no-progress; then
                  break
                fi
                if [ "$attempt" = 3 ]; then
                  echo "bun install failed after $attempt attempts" >&2
                  exit 1
                fi
                # A truncated tarball survives in the cache and fails identically on retry.
                rm -rf "$HOME/.bun/install/cache" node_modules
                sleep $((attempt * 5))
              done
            '';
            installPhase = ''
              cp -r node_modules $out
            '';
          };
        in
        {
          default = pkgs.stdenv.mkDerivation {
            pname = "dircmp";
            version = packageJson.version;
            src = ./.;
            nativeBuildInputs = [ pkgs.bun ];
            dontStrip = true;
            dontPatchELF = true;
            buildPhase = ''
              cp -r ${node_modules} node_modules
              chmod -R u+w node_modules
              bun scripts/build-binary.ts --outfile dircmp
            '';
            installPhase = ''
              mkdir -p $out/bin
              cp dircmp $out/bin/

              # Shell completions
              mkdir -p $out/share/bash-completion/completions
              mkdir -p $out/share/zsh/site-functions
              mkdir -p $out/share/fish/vendor_completions.d
              $out/bin/dircmp completions bash > $out/share/bash-completion/completions/dircmp
              $out/bin/dircmp completions zsh > $out/share/zsh/site-functions/_dircmp
              $out/bin/dircmp completions fish > $out/share/fish/vendor_completions.d/dircmp.fish
            '';
            meta.license = pkgs.lib.licenses.mit;
          };
        }
      );
    };
}
