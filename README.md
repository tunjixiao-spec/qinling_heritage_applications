# 秦岭地名文化遗产研学应用

秦岭两侧地名社区与文化资料的研学观察页面。以当前 C / CB 成果组织两条成对观察线，提供路线地图、节点侧栏、小地图、社区解释矩阵与讲解稿。

- 最新成果：[place_barrier_results](https://tunjixiao-spec.github.io/place_barrier_results/)
- 数据版本：`a142072f2a41f09803e4bcf4761f2569d92b07c5`
- 界面来源：[qinling_heritage_pages](https://tunjixiao-spec.github.io/qinling_heritage_pages/)，保留其页面组成和原样 CSS。
- C 主方案选窗：20928（秦岭可靠窗最大 JSD）与 20918（最小 JSD），并列给出同窗口 CB 结果。
- 主尺度：100km 窗长、每侧50km、20km步长、每侧至少30条有效来源。

公开地图点是至少5条有效来源的20km格网中心；图上连线表示观察顺序。文化资料提供核查线索，未认证为窗口内遗址或已落实的参访点。当前没有正式显著连续段，社区编号也不是已认证的语义类别。

`web/` 为静态发布文件；GitHub Pages 工作流部署该目录。计算源码、原始村级点、来源标识和完整私有复现库不在此仓库中。Leaflet 1.9.4 使用其自带许可，见 `web/static/vendor/leaflet/LICENSE.txt`。

