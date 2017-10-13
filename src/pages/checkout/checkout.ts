import { Component } from '@angular/core';
import { NavController, Platform, AlertController } from 'ionic-angular';
import { Http, Headers } from '@angular/http';

// Custom
import { StorageMulti } from '../../service/storage-multi.service';
import { Core } from '../../service/core.service';
import { TranslateService } from '../../module/ng2-translate';
import { InAppBrowser } from '@ionic-native/in-app-browser';
import { Toast } from '@ionic-native/toast';

//Pipes
import { ObjectToArray } from '../../pipes/object-to-array';

// Page
import { AddressPage } from '../address/address';
import { ThanksPage } from '../thanks/thanks';

declare var wordpress_url;

@Component({
	selector: 'page-checkout',
	templateUrl: 'checkout.html',
	providers: [Core, StorageMulti, ObjectToArray]
})
export class CheckoutPage {
	AddressPage = AddressPage;
	ThanksPage = ThanksPage;
	login: Object; user: Object; cart: Object; coupon: Object[] = []; data: any;
	shipping: string; payment: string; products: Object[];
	trans: string;

	constructor(
		private storageMul: StorageMulti,
		private core: Core,
		private navCtrl: NavController,
		private http: Http,
		private platform: Platform,
		private InAppBrowser: InAppBrowser,
		private Toast: Toast,
		translate: TranslateService,
		private alertCtrl: AlertController
	) {
		translate.get('checkout.has_error').subscribe(trans => this.trans = trans);
		core.showLoading();
	}
	ionViewDidEnter() {
		this.core.showLoading();
		this.storageMul.get(['login', 'user', 'cart', 'coupon']).then(val => {
			if (val["login"] && val["login"]["token"]) this.login = val["login"];
			if (val["user"]) this.user = val["user"];
			if (val["cart"]) {
				this.cart = val["cart"];
				if (this.user) {
					this.products = [];
					new ObjectToArray().transform(this.cart).forEach(product => {
						let now = {};
						now['product_id'] = product['id'];
						now['quantity'] = product['quantity'];
						if (product['variation_id']) now['variation_id'] = product['variation_id'];
						this.products.push(now);
					});
					let params = {};
					params['products'] = JSON.stringify(this.products);
					if (val['coupon']) params['coupons'] = JSON.stringify(val['coupon']);
					params['country'] = this.user['shipping_country'];
					params['postcode'] = this.user['shipping_postcode'];
					let option = {
						search: this.core.objectToURLParams(params)
					};
					if (this.login && this.login['token']) {
						let headers = new Headers();
						headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
						headers.set('Authorization', 'Bearer ' + this.login["token"]);
						option['withCredentials'] = true;
						option['headers'] = headers;
					}
					this.http.get(wordpress_url + '/wp-json/wooconnector/calculator/getall', option).subscribe(res => {
						this.data = res.json();
						if (this.data['total']['discount']) {
							this.coupon = this.data['total']['discount'];
						}
						if (this.data['shipping']) {
							this.data['shipping'].forEach(shipping => {
								shipping['cost'] = Number(shipping['price']) + Number(shipping['tax']);
							});
							this.changeShipping(this.data['shipping'][0]);
						}
						if (this.data['payment']) this.payment = this.data['payment'][0]['id'];
						this.data['_total'] = 0;
						this.data['_tax'] = 0;
						let product: Object[];
						if (!this.data['total']['discount']) product = this.data['total'];
						else product = this.data['total']['baseitem'];
						if (product && !product['errors']) {
							if (!this.data['total']['discount']) {
								product['total'].forEach(val => {
									this.data['_tax'] += val['tax'];
									this.data['_total'] += val['subtotal'];
								});
							} else {
								this.data['total']['tax'].forEach(tax => this.data['_tax'] += tax['value']);
								this.data['_total'] = this.data['total']['subtotal'];
							}
						} else if(this.data['total']['errors']) {
							let message: string = '';
							for(var key in this.data['total']['errors']){
								if(this.data['total']['errors'][key]) message += ' '+this.data['total']['errors'][key][0];
							}
							this.showAlert(message);
						}
						this.core.hideLoading();
					});
				}
			}
		});
	}
	total(): Number {
		let total: Number = this.data['_total'] + this.data['_tax'];
		if (this.data['_shipping']) total += this.data['_shipping'];
		if (this.data['_shipping_tax']) total += this.data['_shipping_tax'];
		this.coupon.forEach(val => {
			total = Number(total) - (val['value']);
		});
		if (total < 0) total = 0;
		return total;
	}
	changeShipping(shipping) {
		this.shipping = shipping['id'];
		this.data['_shipping'] = Number(shipping['price']);
		this.data['_shipping_tax'] = 0;
		if (shipping['tax']) shipping['tax'].forEach(tax => this.data['_shipping_tax'] += tax['value']);
	}
	confirm() {
		this.core.showLoading();
		let params = {};
		params['products'] = JSON.stringify(this.products);
		Object.assign(params, this.core.filterProfile(this.user));
		params['billing_email'] = this.user['user_email'];
		params['shipping_method'] = this.shipping;
		params['payment_method'] = this.payment;
		if (this.coupon) {
			let coupon: string[] = [];
			this.coupon.forEach(item => coupon.push(item['code']));
			params['coupons'] = JSON.stringify(coupon);
		}
		params = this.core.objectToURLParams(params);
		if (this.login && this.login['token']) {
			let headers = new Headers();
			headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
			headers.set('Authorization', 'Bearer ' + this.login["token"]);
			this.http.post(wordpress_url + '/wp-json/wooconnector/checkout/processcheckout', params, {
				headers: headers,
				withCredentials: true
			}).subscribe(res => {
				this.core.hideLoading();
				this.checkout(res.json());
			}, err => {
				this.core.hideLoading();
				this.showAlert(err.json()['message']);
			});
		} else {
			this.http.post(wordpress_url + '/wp-json/wooconnector/checkout/processcheckout', params)
				.subscribe(res => {
					this.core.hideLoading();
					this.checkout(res.json());
				}, err => {
					this.core.hideLoading();
					this.showAlert(err.json()['message']);
				});
		}
	}
	showAlert(message: string) {
		let alert = this.alertCtrl.create({
			message: message,
			cssClass: 'alert-no-title',
			buttons: [this.trans['button']]
		});
		alert.present();
	}
	checkout(res) {
		let checkoutUrl = wordpress_url + '/wooconnector-checkout?data_key=' + res;
		if (this.platform.is('cordova')) {
			this.platform.ready().then(() => {
				let isCheckout: boolean = false;
				let openCheckout = this.InAppBrowser.create(checkoutUrl, '_blank', 'location=no,toolbar=no');
				openCheckout.on('loadstart').subscribe(res => {
					if (res.url.indexOf(wordpress_url) == 0 && res.url.indexOf('order-received') != -1) {
						let params = res.url.split('?');
						if (params.length > 1 && !isCheckout) {
							isCheckout = true;
							params = params[1].split('&');
							params.forEach(val => {
								let now = val.split('=');
								if (now[0] == 'key' && now['1'].indexOf('wc_order') == 0) {
									let id: any = (res.url.split('?')[0]).split('/');
									if (Number.isInteger(Number(id[id.length - 1]))) id = id[id.length - 1];
									else id = id[id.length - 2];
									openCheckout.close();
									this.navCtrl.push(this.ThanksPage, { id: id }).then(() => {
										this.navCtrl.remove(1, this.navCtrl.length() - 2);
										this.storageMul.remove(['cart', 'coupon']);
									});
								}
							});
						}
					}
				});
				openCheckout.on('loaderror').subscribe(res => {
					openCheckout.close();
					this.Toast.showLongBottom(this.trans['message']).subscribe(
						toast => { },
						error => { console.log(error); }
					);
				});
			});
		}
	}
}