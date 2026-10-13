import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getZipArgs } from './inputs.ts';
import { withEnv } from './test-env.ts';

test( 'passes nothing for empty inputs', () => {
	assert.deepEqual(
		withEnv( { INPUT_SLUG: '', INPUT_CHECKSUMS: '' }, getZipArgs ),
		[],
		'Empty inputs should leave the wp-release defaults in place.'
	);
} );

test( 'maps inputs to wp-release zip flags', () => {
	assert.deepEqual(
		withEnv(
			{
				'INPUT_SOURCE-DIR': 'dist',
				INPUT_SLUG: 'my-plugin',
				INPUT_VERSION: '1.2.0',
				'INPUT_FILENAME-FORMAT': '{slug}',
				INPUT_OUTPUT: 'build/my-plugin.zip',
				INPUT_EXCLUDE: 'build/,tests/',
				'INPUT_EXCLUDE-GITATTRIBUTES': 'true',
				INPUT_CHECKSUMS: 'true',
				INPUT_FORCE: 'false',
			},
			getZipArgs
		),
		[
			'--slug',
			'my-plugin',
			'--source-dir',
			'dist',
			'--version',
			'1.2.0',
			'--filename-format',
			'{slug}',
			'--output',
			'build/my-plugin.zip',
			'--exclude',
			'build/,tests/',
			'--exclude-gitattributes',
			'--checksums',
		],
		'Each set input should map to its CLI flag, and a false boolean to none.'
	);
} );

test( 'maps "false" to the flags that turn a default off', () => {
	assert.deepEqual(
		withEnv(
			{ INPUT_DISTIGNORE: 'false', 'INPUT_ROOT-FOLDER': 'false' },
			getZipArgs
		),
		[ '--no-distignore', '--no-root-folder' ],
		'distignore and root-folder accept "false" like the CLI negations.'
	);
	assert.deepEqual(
		withEnv(
			{ INPUT_DISTIGNORE: '.myignore', 'INPUT_ROOT-FOLDER': 'plugin' },
			getZipArgs
		),
		[ '--distignore', '.myignore', '--root-folder', 'plugin' ],
		'Other values should be passed as paths and names.'
	);
} );

test( 'rejects a boolean input that is not true or false', () => {
	assert.throws(
		() => withEnv( { INPUT_CHECKSUMS: 'ture' }, getZipArgs ),
		/Input does not meet YAML 1.2/,
		'A typo should fail instead of silently turning the option off.'
	);
} );

test( 'passes a configured package instead of the default slug', () => {
	assert.deepEqual(
		withEnv(
			{
				INPUT_PACKAGE: 'plugins/my-plugin',
				INPUT_SLUG: 'my-repository',
				INPUT_CHECKSUMS: 'true',
			},
			getZipArgs
		),
		[ '--package', 'plugins/my-plugin', '--checksums' ],
		'The directory of the configured package should set the slug instead of the repository name default.'
	);
	assert.deepEqual(
		withEnv(
			{
				INPUT_PACKAGE: 'plugins/my-plugin',
				INPUT_EXCLUDE: 'tests/',
			},
			getZipArgs
		),
		[ '--package', 'plugins/my-plugin', '--exclude', 'tests/' ],
		'Other inputs that the config sets should still be passed, so that wp-release rejects them instead of ignoring them.'
	);
} );
