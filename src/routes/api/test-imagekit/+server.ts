import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export const GET: RequestHandler = async () => {
	return json({
		hasUrlEndpoint: !!publicEnv.PUBLIC_IMAGEKIT_URL_ENDPOINT,
		hasPublicKey: !!privateEnv.IMAGEKIT_PUBLIC_KEY,
		hasPrivateKey: !!privateEnv.IMAGEKIT_PRIVATE_KEY,
		urlEndpoint: publicEnv.PUBLIC_IMAGEKIT_URL_ENDPOINT ? 'SET' : 'NOT SET',
		publicKey: privateEnv.IMAGEKIT_PUBLIC_KEY ? 'SET' : 'NOT SET',
		privateKey: privateEnv.IMAGEKIT_PRIVATE_KEY ? 'SET' : 'NOT SET'
	});
};
