import { setOutput } from '@actions/core';
import {
	GitHubActionsWriter,
	Logger,
	execute,
	logError,
} from '@wpelevator/wp-release';
import { getZipArgs } from './inputs.ts';

const logger = new Logger( { writer: new GitHubActionsWriter() } );

try {
	const { result } = await execute( 'zip', getZipArgs(), {
		cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
		logger,
	} );
	const { zipPath, checksumsPath, files } = result;

	setOutput( 'zip-path', zipPath );
	setOutput( 'checksums-path', checksumsPath ?? '' );
	setOutput( 'files', files );
} catch ( error ) {
	logError( logger, error, 'WP Release Zip' );
	process.exitCode = 1;
}
