import type { PageServerLoad, Actions } from './$types';
import { fail, error, redirect } from '@sveltejs/kit';
import { message, superValidate } from 'sveltekit-superforms/server';
import { saveSettings, formatWords } from '$lib/helpers';
import {
	generalSettingsSchema,
	generalSettingsToGet,
	generalSettingsServices,
	generalSettingsToPass,
	generalSettingsToSet
} from '$lib/forms/helpers';

export const load: PageServerLoad = async ({ fetch }) => {
	async function getPartialSettings() {
		try {
			const results = await fetch(
				`http://127.0.0.1:8080/settings/get/${generalSettingsToGet.join(',')}`
			);
			return await results.json();
		} catch (e) {
			console.error(e);
			error(503, 'Unable to fetch settings data. API is down.');
		}
	}

	let data: any = await getPartialSettings();
	let toPassToSchema = generalSettingsToPass(data);

	const form = await superValidate(toPassToSchema, generalSettingsSchema);
	return { form };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await superValidate(event, generalSettingsSchema);
		console.log(event.url.searchParams);

		if (!form.valid) {
			return fail(400, {
				form
			});
		}
		const toSet = generalSettingsToSet(form);

		try {
			const data = await saveSettings(event.fetch, toSet);
		} catch (e) {
			console.error(e);
			return message(form, 'Unable to save settings. API is down.', {
				status: 400
			});
		}

		const data = await event.fetch('http://127.0.0.1:8080/services');
		const services = await data.json();
		const allServicesTrue: boolean = generalSettingsServices.every(
			(service) => services.data[service] === true
		);
		if (!allServicesTrue) {
			return message(
				form,
				`${generalSettingsServices.map(formatWords).join(', ')} service(s) failed to initialize. Please check your settings.`,
				{
					status: 400
				}
			);
		}

		if (event.url.searchParams.get('onboarding') === 'true') {
			redirect(302, '/onboarding/2');
		}

		return message(form, 'Settings saved!');
	}
};
