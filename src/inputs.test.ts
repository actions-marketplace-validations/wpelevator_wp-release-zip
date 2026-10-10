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
				INPUT_CHECKSUMS: 'true',
				INPUT_FORCE: 'false',
			},
			getZipArgs
		),
		[
			'--source-dir',
			'dist',
			'--slug',
			'my-plugin',
			'--version',
			'1.2.0',
			'--filename-format',
			'{slug}',
			'--output',
			'build/my-plugin.zip',
			'--exclude',
			'build/,tests/',
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
