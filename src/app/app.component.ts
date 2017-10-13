import { Component, NgZone } from '@angular/core';
import { Platform, AlertController } from 'ionic-angular';
import { StatusBar } from '@ionic-native/status-bar';
import { SplashScreen } from '@ionic-native/splash-screen';
import { Http } from '@angular/http';
import { Core } from '../service/core.service';

// Custom
import { TranslateService } from '../module/ng2-translate';
import { Storage } from '@ionic/storage';
import { Config } from '../service/config.service';
import { Network } from '@ionic-native/network';
import { AdMobFreeBanner, AdMobFreeInterstitial } from '@ionic-native/admob-free';
import { GoogleAnalytics } from '@ionic-native/google-analytics';

// Page
import { HomePage } from '../pages/home/home';
import { LoginPage } from '../pages/login/login';

declare var wordpress_url: string;
declare var application_language: string;
declare var google_analytics: string;
declare var admob_android_banner: string;
declare var admob_android_interstitial: string;
declare var admob_ios_banner: string;
declare var admob_ios_interstitial: string;

@Component({
	templateUrl: 'app.html',
	providers: [Core, AdMobFreeBanner, AdMobFreeInterstitial, GoogleAnalytics]
})
export class MyApp {
	HomePage = HomePage;
	LoginPage = LoginPage;
	rootPage = null;
	trans: Object;
	isLoaded: boolean;
	disconnect: boolean;
	constructor(
		platform: Platform,
		translate: TranslateService,
		storage: Storage,
		http: Http,
		core: Core,
		config: Config,
		ngZone: NgZone,
		alertCtrl: AlertController,
		StatusBar: StatusBar,
		SplashScreen: SplashScreen,
		Network: Network,
		banner: AdMobFreeBanner,
		interstitial: AdMobFreeInterstitial,
		ga: GoogleAnalytics
	) {
		translate.setDefaultLang(application_language);
		translate.use(application_language);
		translate.get('general').subscribe(trans => {
			storage.get('login').then(login => {
				let params: any = {};
				if (login && login['token']) params['jwt_token'] = login['token'];
				let getStatic = () => {
					http.get(wordpress_url + '/wp-json/modernshop/static/gettextstatic', {
						search: core.objectToURLParams(params)
					}).subscribe(res => {
						http.get(wordpress_url + '/wp-json/wooconnector/settings/getactivelocaltion')
							.subscribe(location => {
								config.set('currency', res.json()['currency']);
								config.set('text_static', res.json()['text_static']);
								config.set('check_https', res.json()['check_https']);
								config.set('countries', location.json()['countries']);
								config.set('states', location.json()['states']);
								this.rootPage = this.HomePage;
								this.isLoaded = true;
								if (res.json()['login_expired']) {
									storage.remove('login').then(() => {
										let alert = alertCtrl.create({
											message: trans['login_expired']['message'],
											cssClass: 'alert-no-title',
											enableBackdropDismiss: false,
											buttons: [trans['login_expired']['button']]
										});
										alert.present();
									});
								}
							}, () => {
								showAlert();
							});
					}, () => {
						showAlert();
					});
				};
				getStatic();
				let showAlert = () => {
					let alert = alertCtrl.create({
						message: trans['error_first']['message'],
						cssClass: 'alert-no-title',
						enableBackdropDismiss: false,
						buttons: [
							{
								text: trans['error_first']['button'],
								handler: () => {
									getStatic();
								}
							}
						]
					});
					alert.present();
				};
			});
		});
		platform.ready().then(() => {
			let admob: Object;
			if (platform.is('android')) {
				admob = {
					banner: admob_android_banner,
					interstitial: admob_android_interstitial
				};
			} else if (platform.is('ios')) {
				admob = {
					banner: admob_ios_banner,
					interstitial: admob_ios_interstitial
				};
			}
			if (admob && admob['banner']) {
				banner.config({
					id: admob['banner'],
					overlap: false,
					autoShow: true,
					size: 'BANNER'
				});
				banner.prepare();
			}
			if (admob && admob['interstitial']) {
				interstitial.config({
					id: admob['interstitial'],
					autoShow: true
				});
				interstitial.prepare();
			}
			if (platform.is('cordova') && google_analytics) {
				ga.startTrackerWithId(google_analytics).then(() => {
					ga.trackView(platform.is('android') ? 'Android' : 'iOS');
				});
			}
			StatusBar.styleDefault();
			setTimeout(() => {
				SplashScreen.hide();
			}, 100);
			Network.onDisconnect().subscribe(() => {
				ngZone.run(() => { this.disconnect = true; });
			});
			Network.onConnect().subscribe(() => {
				ngZone.run(() => { this.disconnect = false; });
			});
		});
		storage.get('text').then(val => {
			let html = document.querySelector('html');
			html.className = val;
		});
	}
}
