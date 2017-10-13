import { Component, ViewChild } from '@angular/core';
import { NavParams } from 'ionic-angular';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';

// Custom
import { Core } from '../../service/core.service';
import { Storage } from '@ionic/storage';

//Pipes
import { ObjectToArray } from '../../pipes/object-to-array';

// Page
import { DetailPage } from '../detail/detail';

declare var wordpress_url: string;
declare var wordpress_per_page: Number;

@Component({
	selector: 'page-detail-category',
	templateUrl: 'detail-category.html',
	providers: [Core, ObjectToArray]
})
export class DetailCategoryPage {
	@ViewChild('cart') buttonCart;
	DetailPage = DetailPage;
	DetailCategoryPage = DetailCategoryPage;
	id: Number; page = 1; sort: string = "name"; range: Object = { lower: 0, upper: 0 };
	data: Object = {}; favorite: Object = {}; products: Object[] = []; attributes: Object[] = [];
	filter: Object = { grid: true, open: null, value: {}, valueCustom: {} }; filtering: boolean;
	categories: Object[] = []; loaded: boolean;

	constructor(
		private navParams: NavParams,
		private core: Core,
		private http: Http,
		private storage: Storage
	) {
		this.id = navParams.get('id');
		core.showLoading();
		let params = { term_id: this.id };
		http.get(wordpress_url + '/wp-json/wooconnector/product/getcategories', {
			search: core.objectToURLParams(params)
		}).subscribe(res => {
			this.data = res.json()[0];
			this.getProducts().subscribe(products => {
				if (products.length > 0) this.page++;
				this.products = products;
				this.loaded = true;
				http.get(wordpress_url + '/wp-json/wooconnector/product/getattribute')
					.subscribe(res => {
						this.attributes = res.json();
						this.attributes['custom'] = new ObjectToArray().transform(this.attributes['custom']);
						this.reset();
						core.hideLoading();
					});
			});
			this.loadCategories();
		});
	}
	ionViewDidEnter() {
		this.getFavorite();
		this.buttonCart.update();
	}
	loadCategories() {
		let params = { cat_num_page: 1, cat_per_page: 100, parent: this.id };
		this.http.get(wordpress_url + '/wp-json/wooconnector/product/getcategories', {
			search: this.core.objectToURLParams(params)
		}).subscribe(res => {
			this.categories = this.categories.concat(res.json());
			if (res.json().length == 100) {
				params.cat_num_page++;
				this.loadCategories();
			}
		});
	};
	getFavorite() {
		this.storage.get('favorite').then(val => { if (val) this.favorite = val });
	}
	getProducts(): Observable<Object[]> {
		return new Observable(observable => {
			let tmpFilter = [];
			for (var filter in this.filter['value']) {
				let attr = this.filter['value'][filter];
				if (Object.keys(attr).length > 0) for (var option in attr) {
					if (attr[option]) {
						let now = {};
						now['keyattr'] = filter;
						now['valattr'] = option;
						now['type'] = 'attributes';
						tmpFilter.push(now);
					}
				};
			}
			for (var filter in this.filter['valueCustom']) {
				let attr = this.filter['value'][filter];
				if (attr && Object.keys(attr).length > 0) for (var option in attr) {
					if (attr[option]) {
						let now = {};
						now['keyattr'] = filter;
						now['valattr'] = option;
						now['type'] = 'custom';
						tmpFilter.push(now);
					}
				};
			}
			if (tmpFilter.length == 0 && !this.range['lower'] && !this.range['upper']) {
				let params = {
					post_category: this.id.toString(),
					post_num_page: this.page,
					post_per_page: wordpress_per_page
				};
				this.http.get(wordpress_url + '/wp-json/wooconnector/product/getproduct', {
					search: this.core.objectToURLParams(params)
				}).subscribe(products => {
					observable.next(products.json());
					observable.complete();
				});
			} else {
				let params = {};
				params['post_category'] = this.id.toString();
				if (tmpFilter.length > 0) params['attribute'] = JSON.stringify(tmpFilter);
				params['post_num_page'] = this.page;
				params['post_per_page'] = wordpress_per_page;
				if (this.range['lower'] != 0) params['min_price'] = this.range['lower'];
				if (this.range['upper'] != 0) params['max_price'] = this.range['upper'];
				this.http.get(wordpress_url + '/wp-json/wooconnector/product/getproductbyattribute', {
					search: this.core.objectToURLParams(params)
				}).subscribe(products => {
					observable.next(products.json());
					observable.complete();
				});
			}
		});
	}
	doRefresh(refresher) {
		this.page = 1;
		this.getProducts().subscribe(products => {
			if (products.length > 0) this.page++;
			this.products = [];
			this.products = products;
			refresher.complete();
		});
	}
	load(infiniteScroll) {
		this.getProducts().subscribe(products => {
			if (products.length > 0) this.page++;
			this.products = this.products.concat(products);
			infiniteScroll.complete();
		});
	}
	openCategory() {
		if (this.filter['open'] == 'category') this.filter['open'] = null;
		else this.filter['open'] = 'category';
	}
	openFilter() {
		if (this.filter['open'] == 'filter') this.filter['open'] = null;
		else this.filter['open'] = 'filter';
	}
	openSort() {
		if (this.filter['open'] == 'sort') this.filter['open'] = null;
		else this.filter['open'] = 'sort';
	}
	changeFavorite(product: Object) {
		if (this.favorite[product["id"]]) {
			delete this.favorite[product["id"]];
			this.storage.set('favorite', this.favorite);
		} else {
			let data: any = {
				id: product["id"],
				name: product["name"],
				regular_price: product["regular_price"],
				sale_price: product["sale_price"],
				price: product["price"],
				on_sale: product["on_sale"],
				price_html: product["price_html"],
				type: product["type"]
			};
			if (product["modernshop_images"]) data['images'] = product["modernshop_images"][0].modern_square;
			this.favorite[product["id"]] = data;
			this.storage.set('favorite', this.favorite);
		}
	}
	reset() {
		this.filter['value'] = {};
		this.filter['valueCustom'] = {};
		this.attributes['attributes'].forEach(attr => {
			this.filter['value'][attr['slug']] = {};
		});
		this.attributes['custom'].forEach(attr => {
			this.filter['valueCustom'][attr['slug']] = {};
		});
		this.range = { lower: 0, upper: 0 };
	}
	runFilter() {
		this.openFilter();
		this.page = 1;
		this.products = [];
		this.loaded = false;
		this.filtering = true;
		this.core.showLoading();
		this.getProducts().subscribe(products => {
			if (products && products.length > 0) this.page++;
			this.products = products;
			this.filtering = false;
			this.loaded = true;
			this.core.hideLoading();
		});
	}
}