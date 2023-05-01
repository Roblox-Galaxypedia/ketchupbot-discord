module.exports = {
	"env": {
		"node": true,
		"commonjs": true,
		"es6": true
	},
	"parser": "@typescript-eslint/parser",
	"plugins": [
		"@typescript-eslint"
	],
	"root": true,
	"extends": [
		"eslint:recommended",
		"plugin:@typescript-eslint/eslint-recommended",
		"plugin:@typescript-eslint/recommended"
	],
	"parserOptions": {
		"ecmaVersion": "latest"
	},
	"rules": {
		"quotes": [
			"error",
			"double"
		],
		"semi": [
			"error",
			"never"
		],
		"@typescript-eslint/no-non-null-assertion": "off"
	}
}