default: build

build:
	pnpm build

build-no-cache:
	pnpm build:no-cache

clean:
	pnpm clean

changeset:
	pnpm changeset

link:
	@cd packages/cli && pnpm link --global
	@echo "gigadrive CLI should now be available globally"