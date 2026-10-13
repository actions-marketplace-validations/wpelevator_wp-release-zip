import { test } from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	generateSigningKeyPair,
	getSignaturePath,
	parsePublicKey,
	verifyFileSignature,
} from '@wpelevator/wp-release';
import type { SignatureFormat } from '@wpelevator/wp-release';
import { withEnv } from './test-env.ts';

/**
 * Read an output written by @actions/core, including multiline values.
 *
 * @param path GitHub output file.
 * @param name Output name.
 * @return Output value.
 */
function readOutput( path: string, name: string ): string {
	const match = readFileSync( path, 'utf8' ).match(
		new RegExp( `^${ name }<<([^\\n]+)\\n([\\s\\S]*?)\\n\\1$`, 'm' )
	);

	assert.ok( match, `The action should set the ${ name } output.` );

	return match[ 2 ] ?? '';
}

/**
 * Run the action with a temporary plugin and GitHub output files.
 *
 * @param t Test context for cleaning up temporary files.
 * @return Fixture paths, signing keys and action runner.
 */
function fixture( t: TestContext ) {
	const cwd = mkdtempSync( join( tmpdir(), 'wp-release-zip-action-' ) );
	const output = join( cwd, 'outputs' );
	const summary = join( cwd, 'summary' );
	const zipPath = join( cwd, 'example.zip' );
	const checksumsPath = join( cwd, 'example.checksums.json' );
	const keys = generateSigningKeyPair();

	t.after( () => rmSync( cwd, { recursive: true, force: true } ) );
	mkdirSync( join( cwd, 'source' ) );
	writeFileSync(
		join( cwd, 'source', 'example.php' ),
		'<?php /* Plugin Name: Example */'
	);
	writeFileSync( output, '' );
	writeFileSync( summary, '' );

	const run = ( inputs: Record< string, string > ) =>
		withEnv(
			{
				GITHUB_WORKSPACE: cwd,
				GITHUB_OUTPUT: output,
				GITHUB_STEP_SUMMARY: summary,
				WP_RELEASE_SIGNING_KEY: '',
				'INPUT_SOURCE-DIR': 'source',
				INPUT_SLUG: 'example',
				INPUT_OUTPUT: zipPath,
				'INPUT_SIGNING-KEY': keys.privateKey,
				...inputs,
			},
			() =>
				spawnSync(
					process.execPath,
					[ fileURLToPath( new URL( './run.ts', import.meta.url ) ) ],
					{ cwd, env: process.env, encoding: 'utf8' }
				)
		);

	return { output, summary, zipPath, checksumsPath, keys, run };
}

test( 'unsigned ZIPs expose empty signing outputs', ( t ) => {
	const { output, zipPath, run } = fixture( t );
	const result = run( {} );

	assert.equal( result.status, 0, result.stdout + result.stderr );
	assert.equal(
		readOutput( output, 'zip-path' ),
		zipPath,
		'The ZIP output should remain an absolute path.'
	);
	assert.equal(
		readOutput( output, 'signatures' ),
		'',
		'Providing a key alone should not enable signing.'
	);
	assert.equal(
		readOutput( output, 'public-key' ),
		'',
		'Unsigned ZIPs should have no signing key output.'
	);
} );

test( 'signs the ZIP and manifest with the default format', async ( t ) => {
	const { output, summary, zipPath, checksumsPath, keys, run } = fixture( t );
	const result = run( { INPUT_SIGN: 'true', INPUT_CHECKSUMS: 'true' } );

	assert.equal( result.status, 0, result.stdout + result.stderr );
	assert.equal(
		readOutput( output, 'checksums-path' ),
		checksumsPath,
		'The manifest output should remain an absolute path.'
	);
	assert.equal(
		readOutput( output, 'signatures' ),
		`${ zipPath }.sig\n${ checksumsPath }.sig`,
		'Signing should list both signature paths, one per line.'
	);
	assert.equal(
		readOutput( output, 'public-key' ),
		keys.publicKey,
		'The public key should correspond to the signing input.'
	);
	assert.ok(
		result.stdout.includes( `::add-mask::${ keys.privateKey }` ),
		'The action should mask the signing input.'
	);

	for ( const path of [ zipPath, checksumsPath ] ) {
		assert.ok(
			await verifyFileSignature(
				path,
				`${ path }.sig`,
				parsePublicKey( keys.publicKey )
			),
			'Each signature should verify against the public-key output.'
		);
		assert.ok(
			readFileSync( summary, 'utf8' ).includes(
				`${ path.split( '/' ).pop() }.sig`
			),
			'The job summary should include each signature.'
		);
	}
	assert.ok(
		readFileSync( summary, 'utf8' ).includes( keys.publicKey ),
		'The job summary should include the public key.'
	);
} );

test( 'formats imply signing and accept a key from the environment', async ( t ) => {
	const { output, zipPath, keys, run } = fixture( t );
	const result = run( {
		'INPUT_SIGN-FORMAT': 'minisign,ssh',
		'INPUT_SIGNING-KEY': '',
		WP_RELEASE_SIGNING_KEY: keys.privateKey,
	} );

	assert.equal( result.status, 0, result.stdout + result.stderr );
	assert.equal(
		readOutput( output, 'signatures' ),
		`${ zipPath }.minisig\n${ zipPath }.sshsig`,
		'The selected formats should imply signing without writing a WordPress signature.'
	);
	const formats: SignatureFormat[] = [ 'minisign', 'ssh' ];

	for ( const format of formats ) {
		assert.ok(
			await verifyFileSignature(
				zipPath,
				getSignaturePath( zipPath, format ),
				parsePublicKey( keys.publicKey ),
				format
			),
			'Each selected format should verify with the same key.'
		);
	}
} );

const invalidInputs: Array< {
	name: string;
	inputs: Record< string, string >;
} > = [
	{ name: 'missing key', inputs: { 'INPUT_SIGNING-KEY': '' } },
	{ name: 'invalid key', inputs: { 'INPUT_SIGNING-KEY': 'invalid' } },
	{ name: 'invalid format', inputs: { 'INPUT_SIGN-FORMAT': 'unknown' } },
];

invalidInputs.forEach( ( { name, inputs } ) => {
	test( `rejects signing with ${ name } before writing release files`, ( t ) => {
		const { zipPath, checksumsPath, run } = fixture( t );
		const result = run( {
			INPUT_SIGN: 'true',
			INPUT_CHECKSUMS: 'true',
			...inputs,
		} );

		assert.equal(
			result.status,
			1,
			'Invalid signing inputs should fail the action.'
		);
		assert.equal(
			existsSync( zipPath ),
			false,
			'Signing validation should run before writing the ZIP.'
		);
		assert.equal(
			existsSync( checksumsPath ),
			false,
			'Signing validation should run before writing the manifest.'
		);
	} );
} );

test( 'protects existing signatures unless force is set', async ( t ) => {
	const { zipPath, checksumsPath, keys, run } = fixture( t );
	writeFileSync( `${ checksumsPath }.sig`, 'existing' );
	const rejected = run( { INPUT_SIGN: 'true', INPUT_CHECKSUMS: 'true' } );

	assert.equal(
		rejected.status,
		1,
		'An existing signature should fail the action before creating release files.'
	);
	assert.equal(
		existsSync( zipPath ),
		false,
		'A signature conflict should leave no new ZIP.'
	);
	assert.equal(
		existsSync( checksumsPath ),
		false,
		'A signature conflict should leave no new manifest.'
	);
	assert.equal(
		readFileSync( `${ checksumsPath }.sig`, 'utf8' ),
		'existing',
		'A conflicting signature should remain unchanged.'
	);
	const forced = run( {
		INPUT_SIGN: 'true',
		INPUT_CHECKSUMS: 'true',
		INPUT_FORCE: 'true',
	} );

	assert.equal( forced.status, 0, forced.stdout + forced.stderr );
	assert.ok(
		await verifyFileSignature(
			checksumsPath,
			`${ checksumsPath }.sig`,
			parsePublicKey( keys.publicKey )
		),
		'Force should replace the existing signature with a valid signature.'
	);
} );
