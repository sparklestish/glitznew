import { Component, ViewChild } from '@angular/core';
import { Http } from '@angular/http';
import { Observable } from 'rxjs/Observable';
import { TextInput, NavController } from 'ionic-angular';

// Custom
import { Core } from '../../service/core.service';
import { Storage } from '@ionic/storage';

// Page
import { DetailPage } from '../detail/detail';
import { CategoriesPage } from '../categories/categories';
import { AccountPage } from '../account/account';

declare var wordpress_url: string;
declare var wordpress_per_page: Number;

@Component({
	selector: 'page-search',
	templateUrl: 'search.html',
	providers: [Core]
})
export class SearchPage {
	@ViewChild(TextInput) inputSearch: TextInput;
	@ViewChild('cart') buttonCart;
	DetailPage = DetailPage;
	CategoriesPage = CategoriesPage;
	AccountPage = AccountPage;
	keyword: string;
	products: Object[] = [];
	page = 1;
	grid: boolean = true;
	favorite: Object = {};

	constructor(
		private http: Http,
		private core: Core,
		private storage: Storage,
		private navCtrl: NavController
	) { }
	ngOnInit() {
		if (this.inputSearch) {
			this.inputSearch["clearTextInput"] = (): void => {
				(void 0);
				this.inputSearch._value = '';
				this.inputSearch.onChange(this.inputSearch._value);
				this.inputSearch.writeValue(this.inputSearch._value);
				setTimeout(() => { this.inputSearch.setFocus(); }, 0);
			}
		}
	}
	ionViewDidEnter() {
		this.getFavorite();
		this.buttonCart.update();
	}
	getFavorite() {
		this.storage.get('favorite').then(val => { if (val) this.favorite = val });
	}
	search() {
		this.page = 1;
		this.core.showLoading();
		this.getProducts().subscribe(products => {
			this.core.hideLoading();
			if (products && products.length > 0) this.page++;
			this.products = products;
		});
	}
	getProducts(): Observable<Object[]> {
		return new Observable(observable => {
			let params = {
				search: this.keyword,
				post_num_page: this.page,
				post_per_page: wordpress_per_page
			};
			this.http.get(wordpress_url + '/wp-json/wooconnector/product/getproduct', {
				search: this.core.objectToURLParams(params)
			}).subscribe(products => {
				observable.next(products.json());
				observable.complete();
			});
		});
	}
	load(infiniteScroll) {
		this.getProducts().subscribe(products => {
			if (products.length > 0) this.page++;
			this.products = this.products.concat(products);
			infiniteScroll.complete();
		});
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
	onSwipeContent(e) {
		if (e['deltaX'] < -150 || e['deltaX'] > 150) {
			if (e['deltaX'] < 0) this.navCtrl.push(this.AccountPage);
			else this.navCtrl.push(this.CategoriesPage);
		}
	}
}