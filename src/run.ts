import { isAbsolute } from 'node:path';
import { setOutput } from '@actions/core';
import {
	GitHubActionsWriter,
	Logger,
	execute,
	logError,
} from '@wpelevator/wp-release';
import { getZipArgs, exportSigningKey } from './inputs.ts';

const logger = new Logger( { writer: new GitHubActionsWriter() } );

try {
	exportSigningKey();

	const { result } = await execute( 'zip', getZipArgs(), {
		cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
		logger,
	} );
	const { zipPath, checksumsPath, files, signatures, publicKey } = result;

	setOutput( 'zip-path', zipPath );
	setOutput( 'checksums-path', checksumsPath ?? '' );
	setOutput( 'files', files );
	setOutput( 'checksums-embedded', result.checksumsEmbedded ?? '' );
	setOutput(
		'signatures-embedded',
		signatures?.filter( ( path ) => ! isAbsolute( path ) ).join( '\n' ) ??
			''
	);
	setOutput(
		'signatures',
		signatures?.filter( isAbsolute ).join( '\n' ) ?? ''
	);
	setOutput( 'public-key', publicKey ?? '' );
} catch ( error ) {
	logError( logger, error, 'WP Release Zip' );
	process.exitCode = 1;
}
