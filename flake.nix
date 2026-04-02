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
            outputHash = "sha256-l2AUlUVqCm/YtnhHE9ou29c8Htytp/bS7iBDn8d2iIA=";
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
            '';
          };
        }
      );
    };
}
