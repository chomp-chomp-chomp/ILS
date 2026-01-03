import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async () => {
	return json({
		hasUrlEndpoint: !!env.PUBLIC_IMAGEKIT_URL_ENDPOINT,
		hasPublicKey: !!env.IMAGEKIT_PUBLIC_KEY,
		hasPrivateKey: !!env.IMAGEKIT_PRIVATE_KEY,
		urlEndpoint: env.PUBLIC_IMAGEKIT_URL_ENDPOINT ? 'SET' : 'NOT SET',
		publicKey: env.IMAGEKIT_PUBLIC_KEY ? 'SET' : 'NOT SET',
		privateKey: env.IMAGEKIT_PRIVATE_KEY ? 'SET' : 'NOT SET'
	});
};
