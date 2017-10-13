import { Component, ViewChild } from '@angular/core';
import { Http } from '@angular/http';
import { Platform, NavController } from 'ionic-angular';

// Custom
import { Core } from '../../service/core.service';
import { InAppBrowser } from '@ionic-native/in-app-browser';
import { OneSignal } from '@ionic-native/onesignal';

// Page
import { DetailPage } from '../detail/detail';
import { CategoriesPage } from '../categories/categories';
import { DetailCategoryPage } from '../detail-category/detail-category';
import { LatestPage } from '../latest/latest';
import { FavoritePage } from '../favorite/favorite';
import { AboutPage } from '../about/about';
import { TermsPage } from '../terms/terms';
import { PrivacyPage } from '../privacy/privacy';
import { ContactPage } from '../contact/contact';

declare var wordpress_url: string;
declare var cordova: any;
declare var open_target_blank: boolean;
declare var onesignal_app_id: string;

@Component({
	selector: 'page-home',
	templateUrl: 'home.html',
	providers: [Core]
})
export class HomePage {
	@ViewChild('cart') buttonCart;
	DetailPage = DetailPage;
	CategoriesPage = CategoriesPage;
	DetailCategoryPage = DetailCategoryPage;
	LatestPage = LatestPage;
	FavoritePage = FavoritePage;
	AboutPage = AboutPage;
	TermsPage = TermsPage;
	PrivacyPage = PrivacyPage;
	ContactPage = ContactPage;
	slides: Object[]; deal: any; products: Object[]; categories: Object[] = []; clientSay: Object[] = [];
	loadedProducts: boolean; loadedCategories: boolean;
	latesting: Number; latestIndex: Number = null;

	constructor(
		private http: Http,
		private core: Core,
		private navCtrl: NavController,
		private InAppBrowser: InAppBrowser,
		platform: Platform,
		OneSignal: OneSignal
	) {
		platform.ready().then(() => {
			if (platform.is('cordova')) {
				OneSignal.startInit(onesignal_app_id);
				OneSignal.inFocusDisplaying(OneSignal.OSInFocusDisplayOption.Notification);
				OneSignal.handleNotificationOpened().subscribe(res => {
					let payload = res.notification.payload;
					if (payload && payload['launchURL']) this.openLink(payload['launchURL'], true);
				});
				OneSignal.endInit();
			}
		});
		this.getData();
	}
	ionViewDidEnter() {
		this.buttonCart.update();
	}
	getData(isRefreshing: boolean = false, refresher = null) {
		this.http.get(wordpress_url + '/wp-json/wooslider/product/getslider')
			.subscribe(res => {
				if (isRefreshing) delete this.slides;
				this.slides = res.json();
			});
		this.http.get(wordpress_url + '/wp-json/wooconnector/product/getdealofday', {
			search: this.core.objectToURLParams({
				post_per_page: 4
			})
		}).subscribe(res => {
			if (isRefreshing) delete this.deal;
			this.deal = res.json();
		});
		this.http.get(wordpress_url + '/wp-json/wooconnector/product/getnewcomment')
			.subscribe(res => {
				if (isRefreshing) delete this.clientSay;
				this.clientSay = res.json();
			});
		this.loadLatest();
		if (isRefreshing) {
			this.categories = [];
			this.loadCategories(refresher);
		} else this.loadCategories();
	}
	doRefresh(refresher) {
		this.loadedProducts = false;
		this.loadedCategories = false;
		this.getData(true, refresher);
	}
	loadLatest() {
		if (!this.latesting) {
			let params: any = { post_per_page: 4 };
			this.http.get(wordpress_url + '/wp-json/wooconnector/product/getproduct', {
				search: this.core.objectToURLParams(params)
			}).subscribe(res => {
				this.products = res.json();
				this.loadedProducts = true;
			});
		} else {
			let params: any = { post_per_page: 4, post_category: this.latesting };
			this.http.get(wordpress_url + '/wp-json/wooconnector/product/getproductbycategory', {
				search: this.core.objectToURLParams(params)
			}).subscribe(res => {
				this.products = res.json().products;
				this.loadedProducts = true;
			});
		}
	}
	loadCategories(refresher = null) {
		let params = { parent: '0', cat_per_page: 100, cat_num_page: 1 };
		let loadCategories = () => {
			this.http.get(wordpress_url + '/wp-json/wooconnector/product/getcategories', {
				search: this.core.objectToURLParams(params)
			}).subscribe(res => {
				if (res.json().length > 0) this.categories = this.categories.concat(res.json());
				if (res.json().length == 100) {
					params.cat_num_page++;
					loadCategories();
				} else {
					if (refresher) refresher.complete();
					this.loadedCategories = true;
				}
			});
		};
		loadCategories();
	}
	openLink(url: string, external: boolean = false) {
		if (!url) return;
		if (url.indexOf("link://") == 0) {
			url = url.replace("link://", "");
			let data = url.split("/");
			if (data[0] == "product") this.navCtrl.push(this.DetailPage, { id: data[1] });
			else if (data[0] == "product-category") this.navCtrl.push(this.DetailCategoryPage, { id: data[1] });
			else if (data[0] == "bookmark") this.navCtrl.push(this.FavoritePage);
			else if (data[0] == "about-us") this.navCtrl.push(this.AboutPage);
			else if (data[0] == "term-and-conditions") this.navCtrl.push(this.TermsPage);
			else if (data[0] == "privacy-policy") this.navCtrl.push(this.PrivacyPage);
			else if (data[0] == "contact-us") this.navCtrl.push(this.ContactPage);
		} else if (!external) this.InAppBrowser.create(url, open_target_blank ? "_blank" : "_system", "location=no");
	}
	changeLatest(id: Number, index: Number = null) {
		this.latesting = id;
		this.latestIndex = index;
		this.loadedProducts = false;
		this.loadLatest();
	}
	onSwipe(e) {
		if (e['deltaX'] < -150 || e['deltaX'] > 150) {
			if (e['deltaX'] > 0) {
				if (this.latestIndex == 0) this.changeLatest(0);
				else if (this.categories[Number(this.latestIndex) - 1]) this.changeLatest(this.categories[Number(this.latestIndex) - 1]['id'], Number(this.latestIndex) - 1);
			} else {
				if (this.latestIndex == null && this.categories.length > 0) this.changeLatest(this.categories[0]['id'], 0);
				else if (this.categories[Number(this.latestIndex) + 1]) this.changeLatest(this.categories[Number(this.latestIndex) + 1]['id'], Number(this.latestIndex) + 1);
			}
		}
	}
	onSwipeContent(e) {
		if (e['deltaX'] < -150) this.navCtrl.push(this.CategoriesPage);
	}
	viewAll() {
		if (this.latesting) this.navCtrl.push(this.DetailCategoryPage, { id: this.latesting });
		else this.navCtrl.push(this.LatestPage);
	}
}