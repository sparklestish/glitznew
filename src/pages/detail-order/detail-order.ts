import { Component, ViewChild } from '@angular/core';
import { NavController, NavParams } from 'ionic-angular';
import { Http, Headers } from '@angular/http';
import { Content } from 'ionic-angular';

// Custom
import { Storage } from '@ionic/storage';
import { Core } from '../../service/core.service';
import { Toast } from '@ionic-native/toast';
import { TranslateService } from '../../module/ng2-translate';

declare var wordpress_url:string;
declare var date_format:string;

@Component({
	selector: 'page-detail-order',
	templateUrl: 'detail-order.html',
	providers: [Core]
})
export class DetailOrderPage {
	id:Number; login:Object; data:Object;
	date_format:string = date_format;
	@ViewChild(Content) content: Content;
	trans:Object;
	
	constructor(
		private navCtrl: NavController,
		navParams: NavParams,
		private http: Http,
		storage: Storage,
		private core: Core,
		translate: TranslateService,
		private Toast: Toast
	){
		translate.get('detail').subscribe(trans => this.trans = trans);
		this.id = navParams.get('id');
		core.showLoading();
		storage.get('login').then(val => {
			if(val && val['token']) {
				this.login = val;
				this.getData();
			} else navCtrl.pop();
		});
	}
	getData(){
		this.core.showLoading();
		let headers = new Headers();
		headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
		headers.set('Authorization', 'Bearer '+this.login["token"]);
		this.http.get(wordpress_url+'/wp-json/wooconnector/order/getorderbyid?order='+this.id, {
			headers: headers,
			withCredentials: true
		}).subscribe(res => {
			this.data = res.json();
			this.core.hideLoading();
			this.content.resize();
		});	
	}
	changeStatus(){
		this.core.showLoading();
		let params = this.core.objectToURLParams({order: this.id});
		let headers = new Headers();
		headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
		headers.set('Authorization', 'Bearer '+this.login["token"]);
		this.http.post(wordpress_url+'/wp-json/wooconnector/order/changestatus', params, {
			headers: headers,
			withCredentials: true
		}).subscribe(res => {
			this.core.hideLoading();
			if(res.json()['result'] == 'success'){
				this.Toast.showShortBottom(this.trans["success"]).subscribe(
					toast => {},
					error => {console.log(error);}
				);
				this.navCtrl.pop();
			} else {
				this.Toast.showShortBottom(this.trans["fail"]).subscribe(
					toast => {},
					error => {console.log(error);}
				);
			}
		});	
	}
	doRefresh(refresher){
		this.getData();
		refresher.complete();
	}
}
