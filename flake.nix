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
            outputHash = "sha256-x8yEcvtULYPRkg//YBrihCTUplegXLHqG7jltwji2hE=";
            buildPhase = ''
              export HOME=$TMPDIR
              bun install --frozen-lockfile --no-progress
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
            nativeBuildInputs = [
              pkgs.bun
              pkgs.makeWrapper
            ];
            buildPhase = ''
              cp -r ${node_modules} node_modules
              bun build src/index.tsx --outfile dist/index.js --target=bun --external react-devtools-core
            '';
            installPhase = ''
              mkdir -p $out/lib/dircmp $out/bin
              cp dist/index.js $out/lib/dircmp/

              makeWrapper ${pkgs.bun}/bin/bun $out/bin/dircmp \
                --add-flags "$out/lib/dircmp/index.js"

              # Shell completions
              mkdir -p $out/share/bash-completion/completions
              mkdir -p $out/share/zsh/site-functions
              mkdir -p $out/share/fish/vendor_completions.d
              $out/bin/dircmp completions bash > $out/share/bash-completion/completions/dircmp
              $out/bin/dircmp completions zsh > $out/share/zsh/site-functions/_dircmp
              $out/bin/dircmp completions fish > $out/share/fish/vendor_completions.d/dircmp.fish
            '';
          };
        }
      );
    };
}
