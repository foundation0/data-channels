module.exports = {
    "env": {
        "browser": true,
        "es2021": true
    },
    "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "prettier"
    ],
    "parser": "@typescript-eslint/parser",
    "parserOptions": {
        "ecmaVersion": 13,
        "sourceType": "module"
    },
    "plugins": [
        "@typescript-eslint"
    ],
    "rules": {
        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "no-case-declarations": "off",
        "@typescript-eslint/no-non-null-assertion": ["error"],
        "@typescript-eslint/no-unnecessary-condition": ["error"],
        "@typescript-eslint/strict-boolean-expressions": ["error"],
        "@typescript-eslint/no-extra-non-null-assertion": ["error"],
        "@typescript-eslint/no-non-null-asserted-optional-chain": ["error"],
    }
};
